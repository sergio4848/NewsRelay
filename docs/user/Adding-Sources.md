# Adding Sources / Kaynak ekleme

Sources → Add source. Enter a name, connector and endpoint or X handle. RSS/Atom and REST require HTTPS. Save the definition, reopen it and store the credential if required. Secrets are encrypted on this Windows account. Enable the source when ready; Check sources requests a check now.
Configure trust, group, priority modifier, blocked terms and polling interval. Media remains opt-in. X excludes replies/reposts by default and loads attachments only when requested in Preview. X account/API access is supplied by the customer; successful paid API operation has not been certified by this build.
REST accepts a JSON array. Local webhook accepts one object per authenticated POST:

```json
{
  "id": "example-1",
  "headline": "Example bulletin",
  "body": "Example report",
  "url": "https://example.com/story",
  "publishedAt": "2026-09-21T12:00:00Z",
  "publisher": "Example Desk",
  "media": []
}
```

Webhook connection copying includes its private authorization value. Keep it private. Webhook is loopback-only; remote systems need a separately reviewed local integration. Proprietary payload mapping requires a connector implementation.
Türkçe: Kaynaklar → Kaynak ekle. Bağlayıcıyı, adresi veya X kullanıcı adını girin. Kaydedip tekrar açarak kimlik bilgisini güvenli saklayın. Güven, grup, öncelik ve engellenen ifadeleri ayarlayın. Hazır olunca kaynağı etkinleştirin. Webhook yalnızca aynı bilgisayardan erişilir; bağlantı bilgisini paylaşmayın.
