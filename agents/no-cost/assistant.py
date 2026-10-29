"""Offline preparation only. Python standard library; no network or model calls."""
import argparse
import datetime as dt
import difflib
import hashlib
import json
import pathlib
import re
import unicodedata

SUBJECTS = {'Mathematics', 'Science', 'Social Science', 'Physics', 'Chemistry', 'Biology'}


def normalize(text):
    return ' '.join(re.findall(r'\w+', unicodedata.normalize('NFKC', text).casefold()))


def shape(text):
    return re.sub(r'\d+(?:\.\d+)?', '#', normalize(text))


def validate(candidates, snapshot):
    """Return exclusions and reviewable candidates; never claim semantic deduplication."""
    if not isinstance(candidates, list) or len(candidates) > 200:
        raise ValueError('Expected a JSON array of at most 200 candidates')
    captured = dt.datetime.fromisoformat(snapshot['captured_at'].replace('Z', '+00:00'))
    if captured.tzinfo is None:
        raise ValueError('Snapshot timestamp needs a timezone')
    age = dt.datetime.now(dt.timezone.utc) - captured
    if age.total_seconds() < -300 or age > dt.timedelta(hours=48):
        raise ValueError('Use an authorized snapshot captured within the last 48 hours')
    chapters = {c['chapter_id']: c for c in snapshot['chapters']}
    existing = snapshot['questions']
    if not isinstance(existing, list):
        raise ValueError('questions must include existing active AND inactive questions')
    seen_keys = {q.get('import_key') for q in existing}
    seen = [(normalize(q['question_text']), shape(q['question_text'])) for q in existing]
    accepted, excluded = [], []
    required = ['source_url', 'source_locator', 'source_id', 'candidate_id', 'question_text',
                'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'explanation',
                'difficulty', 'question_usage', 'mapping_reason', 'usage_reason']
    for i, c in enumerate(candidates):
        reasons = []
        if not isinstance(c, dict):
            excluded.append({'index': i, 'reasons': ['Expected an object']})
            continue
        if any(not isinstance(c.get(k), str) or not c[k].strip() for k in required):
            reasons.append('Missing required text/provenance fields')
        if any(type(c.get(k)) is not int for k in ['chapter_id', 'subject_id', 'class_number']):
            excluded.append({'index': i, 'reasons': ['Mapping IDs must be integers']})
            continue
        ch = chapters.get(c.get('chapter_id'))
        if not ch or not ch.get('is_active') or ch.get('class_number') not in range(8, 13) or ch.get('subject_name') not in SUBJECTS:
            reasons.append('Inactive, unsupported or unknown chapter mapping')
        elif c.get('class_number') != ch['class_number'] or c.get('subject_id') != ch['subject_id']:
            reasons.append('Class/subject does not match chapter')
        if c.get('difficulty') not in {'Easy', 'Medium', 'Hard'} or c.get('question_usage') not in {'PRACTICE', 'MOCK', 'SHARED'} or c.get('correct_option') not in {'A', 'B', 'C', 'D'}:
            reasons.append('Invalid difficulty, usage or answer')
        opts = [normalize(str(c.get('option_' + x, ''))) for x in 'abcd']
        if not all(opts) or len(set(opts)) != 4:
            reasons.append('Four distinct nonempty options required')
        if not re.match(r'^https://[^\s]+$', str(c.get('source_url', ''))):
            reasons.append('HTTPS source URL required')
        if c.get('media_references'):
            reasons.append('Media needs separate owned-asset verification; not supported by this text-only pipeline')
        key = 'AI-CANDIDATE-' + hashlib.sha256((str(c.get('source_id')) + '\0' + str(c.get('candidate_id'))).encode()).hexdigest()
        q = normalize(str(c.get('question_text', '')))
        sk = shape(str(c.get('question_text', '')))
        if key in seen_keys or any(q == old or sk == old_shape or difflib.SequenceMatcher(None, q, old, autojunk=False).ratio() >= .9 for old, old_shape in seen):
            reasons.append('Duplicate identity, normalized text, numeric variant or near wording')
        if reasons:
            excluded.append({'index': i, 'reasons': reasons})
        else:
            accepted.append({**c, 'import_key': key})
            seen_keys.add(key)
            seen.append((q, sk))
    return {'status': 'REQUIRES_OWNER_REVIEW', 'snapshot_at': snapshot['captured_at'],
            'accepted_for_review': accepted, 'excluded': excluded,
            'limitations': ['No academic correctness certification', 'Semantic/numeric deduplication still requires human review',
                            'Snapshot completeness must be verified by exporter', 'No production changes or model execution']}


def sql_literal(s):
    return "'" + s.replace("'", "''") + "'"


def draft_sql(result):
    """Inactive HOLD staging draft with live mapping and duplicate guards; dry run by default."""
    lines = ['-- PROPOSED ONLY: review provenance and semantic duplicates before use.',
             '-- Recheck live schema. Run locally in an authorized SQL editor. Default ROLLBACK.',
             'BEGIN;', 'SET LOCAL standard_conforming_strings = on;', "SET LOCAL statement_timeout = '30s';", "SET LOCAL lock_timeout = '5s';",
             "SELECT pg_advisory_xact_lock(hashtextextended('CBSE_PDF_MCQ_IMPORT_2026_27',0));"]
    for c in result['accepted_for_review']:
        texts = [sql_literal(c[k]) for k in ['question_text','option_a','option_b','option_c','option_d','correct_option','explanation','difficulty','question_usage','import_key']]
        norm = "lower(regexp_replace(%s, '[^[:alnum:]]+', '', 'g'))"
        lines.append('INSERT INTO public.questions (chapter_id,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,difficulty,question_usage,import_key,marks,question_type,is_active,content_review_status,media_ready,question_media)\n'
                     + 'SELECT ' + str(c['chapter_id']) + ',' + ','.join(texts) + ",1,'MCQ',false,'HOLD',false,'{}'::jsonb\n"
                     + 'WHERE EXISTS (SELECT 1 FROM public.chapters ch JOIN public.subjects s ON s.id=ch.subject_id JOIN public.classes cl ON cl.id=s.class_id '
                     + f"WHERE ch.id={c['chapter_id']} AND s.id={c['subject_id']} AND cl.id={ {8:3,9:1,10:2,11:4,12:5}[c['class_number']] } AND ch.is_active AND s.is_active AND cl.is_active)\n"
                     + 'AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.import_key=' + sql_literal(c['import_key'])
                     + ' OR ' + norm % 'q.question_text' + '=' + norm % sql_literal(c['question_text']) + ')\nON CONFLICT (import_key) DO NOTHING;')
    keys = ','.join(sql_literal(c['import_key']) for c in result['accepted_for_review']) or 'NULL'
    lines.extend(['SELECT id,chapter_id,import_key,is_active,content_review_status FROM public.questions WHERE import_key IN (' + keys + ');',
                  '-- Replace the final ROLLBACK with COMMIT only after owner review. HOLD rows remain inactive.', 'ROLLBACK;'])
    return '\n'.join(lines) + '\n'


def brief(kind):
    return f'''# {kind} preparation — {dt.datetime.now(dt.timezone.utc).date()}
Status: PENDING_CHATGPT_SESSION. This job has not researched or imported questions.
No paid API calls, database connections, downloads, artifact uploads or caches.

Open agents/no-cost/README.md in ChatGPT with authorized academic exports.
For question research: obtain a fresh complete chapter/question snapshot; prioritize
Maths, Science, Social Science, Physics, Chemistry and Biology for Classes 8–12.
Record source URL/page, stable source/candidate identity, mapping and usage reasons.
Run the offline validator. Review exclusions, academic quality and proposed SQL.
Never upload student records or credentials to public workflow logs.

For monthly maintenance: owner reviews current deployment/CI, admin counts, inactive
HOLD questions, broken media, mapping gaps, free-set report alignment, and snapshot/
alert freshness using authorized read-only access. Report PASS/FAIL/NOT_CHECKED
with evidence timestamps. No cleanup, activation or billing change is authorized
by a scheduled preparation job. No current production health has been verified here.
'''


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest='command', required=True)
    v = sub.add_parser('validate')
    v.add_argument('--candidates', required=True)
    v.add_argument('--snapshot', required=True)
    v.add_argument('--out', required=True)
    b = sub.add_parser('brief')
    b.add_argument('--kind', choices=['fortnightly', 'monthly', 'manual'], default='manual')
    args = p.parse_args()
    if args.command == 'brief':
        print(brief(args.kind))
    else:
        out = pathlib.Path(args.out)
        # Do not leave a stale successful SQL draft after a failed validation rerun.
        out.mkdir(parents=True, exist_ok=True)
        (out / 'proposed.sql').unlink(missing_ok=True)
        result = validate(json.loads(pathlib.Path(args.candidates).read_text()), json.loads(pathlib.Path(args.snapshot).read_text()))
        (out / 'review.json').write_text(json.dumps(result, indent=2, ensure_ascii=False))
        (out / 'proposed.sql').write_text(draft_sql(result))
        print(json.dumps({'reviewable': len(result['accepted_for_review']), 'excluded': len(result['excluded']), 'status': result['status']}))
