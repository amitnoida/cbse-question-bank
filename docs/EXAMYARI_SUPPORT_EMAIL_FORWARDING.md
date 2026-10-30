# ExamYari support@examyari.com — free inbound forwarding

**Current state (30 October 2026):** Domain `examyari.com` uses BigRock nameservers `dns1.bigrock.in` through `dns4.bigrock.in`. Its website is deployed to Vercel, but its DNS must be edited in BigRock. Website DNS entries must NOT be changed during email setup. The live public support address stays `support.cbseexam@gmail.com` until inbound forwarding is verified.

## Recommended no-cost solution

ImprovMX Free: one domain, up to 25 aliases, 500 forwarded messages per day according to [official pricing](https://improvmx.com/pricing/). Inbound forwarding is free, **outbound SMTP sending from support@examyari.com is not included**. Forwarding delivers to an *existing* mailbox, not a newly purchased mailbox. Do not promise replies will be sent from support@examyari.com until authenticated outbound mail is configured.

## Actions for the account owner

1. Select/confirm a destination mailbox that you control (e.g. the existing `support.cbseexam@gmail.com`). Do not publish or forward to an unverified destination. Enable 2FA on the destination inbox.
2. Register an ImprovMX Free account at https://improvmx.com/ and add `examyari.com`.
3. Create alias `support` and enter the destination mailbox. Complete any verification requests.
4. Sign into BigRock at https://myorders.bigrock.in/dashboard, choose Orders → `examyari.com` → DNS Records. Back up the existing DNS record list.
5. If there is no existing email provider using the domain's MX records, add **only these mail records**, cross-checking ImprovMX's current dashboard values:

| Type | Host | Target/value | Priority |
| --- | --- | --- | --- |
| MX | @ | mx1.improvmx.com | 10 |
| MX | @ | mx2.improvmx.com | 20 |
| TXT/SPF | @ | v=spf1 include:spf.improvmx.com ~all | — |

If an SPF record already exists, **edit/merge it** rather than creating a second `v=spf1` record. Do not delete existing MX entries without first verifying who currently receives mail for the domain. The domain A/CNAME and nameservers must remain untouched. Instructions: [ImprovMX generic DNS](https://www.improvmx.com/guides/generic-dns-configuration/) and [BigRock DNS control panel](https://www.bigrock.in/help/article/How-to-add-DNS-records-under-the-BigRock-DNS-panel).

6. Wait for ImprovMX status **Email forwarding active**; DNS propagation can take up to 24–48 hours.
7. From an unrelated email account, send a test message to `support@examyari.com`, verify exact delivery to your destination inbox, then reply from your actual inbox (the reply will appear from the actual sender mailbox unless separate, authenticated SMTP sending has been configured).
8. **Only after a successful inbound delivery test**, update the public footer, `/contact`, `/privacy`, `/terms` and homepage FAQ to use `support@examyari.com`. Keep the original Gmail mailbox as a fallback.

## Privacy and operational boundaries

Forwarded correspondence may include information about children; ensure the destination Gmail account is protected with multifactor authentication. Ask parents not to email identity-document scans, passwords or full student records. Review the provider's privacy terms, logging and retention. Free forwarding is a practical contact route, not a legal compliance certification.

**Pending:** Owner's explicit registration of the ImprovMX domain/alias, confirmation of the destination mailbox, BigRock DNS changes, and a real inbound message test. No credentials or customer emails should be committed to GitHub.
