import datetime as dt
import unittest
from assistant import validate, draft_sql

class PreparationTests(unittest.TestCase):
    def setUp(self):
        self.q = dict(class_number=9, subject_id=3, chapter_id=13, source_url='https://example.org/approved', source_locator='page 2', source_id='source-v1', candidate_id='q1', question_text='Which material occupies space?', option_a='Matter', option_b='Time', option_c='A number', option_d='An idea', correct_option='A', explanation='Matter occupies space.', difficulty='Easy', question_usage='PRACTICE', mapping_reason='Properties of matter', usage_reason='Recall exercise', media_references=[])
        self.snapshot = dict(captured_at=dt.datetime.now(dt.timezone.utc).isoformat(), chapters=[dict(chapter_id=13, subject_id=3, class_number=9, subject_name='Science', is_active=True)], questions=[])

    def test_valid_draft_is_inactive_and_rollback(self):
        r = validate([self.q], self.snapshot)
        self.assertEqual(len(r['accepted_for_review']), 1)
        sql = draft_sql(r)
        self.assertIn("false,'HOLD',false", sql)
        self.assertTrue(sql.endswith('ROLLBACK;\n'))
        self.assertIn('pg_advisory_xact_lock', sql)
        self.assertIn('ch.is_active AND s.is_active AND cl.is_active', sql)

    def test_duplicates_and_changed_identity(self):
        for existing in [dict(question_text=self.q['question_text']), dict(question_text='Different stem', import_key=validate([self.q], self.snapshot)['accepted_for_review'][0]['import_key'])]:
            self.snapshot['questions'] = [existing]
            self.assertEqual(len(validate([self.q], self.snapshot)['excluded']), 1)
        self.snapshot['questions'] = []
        self.assertEqual(len(validate([self.q, {**self.q, 'candidate_id':'q2'}], self.snapshot)['excluded']), 1)

    def test_wrong_mapping_options_media_and_injection_rejected(self):
        for patch in [dict(class_number=10),dict(subject_id=4),dict(chapter_id='13;DROP TABLE questions'),dict(option_b='Matter'),dict(media_references=['diagram.png']),dict(correct_option='E')]:
            self.assertEqual(len(validate([{**self.q, **patch}], self.snapshot)['excluded']), 1)

    def test_numeric_variant(self):
        self.snapshot['questions'] = [dict(question_text='What is the mass of 20 atoms?')]
        self.assertEqual(len(validate([{**self.q, 'question_text':'What is the mass of 30 atoms?'}], self.snapshot)['excluded']), 1)

    def test_stale_snapshot_fails(self):
        self.snapshot['captured_at']='2020-01-01T00:00:00Z'
        with self.assertRaises(ValueError):
            validate([self.q], self.snapshot)

    def test_quotes_and_identity_stable(self):
        a=validate([self.q], self.snapshot)
        b=validate([{**self.q,'question_text':"What is a material's volume?"}], self.snapshot)
        self.assertEqual(a['accepted_for_review'][0]['import_key'], b['accepted_for_review'][0]['import_key'])
        self.assertIn("material''s", draft_sql(b))

if __name__ == '__main__':
    unittest.main()
