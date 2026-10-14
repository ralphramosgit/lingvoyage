# 04. Claude API (the character's brain)

ElevenLabs gives the character a voice, but something has to decide **what the character says**, notice your mistakes and suggest what to say next. That's the LLM. Naviglot uses **Claude Haiku 5.5** (`claude-haiku-5-5`):

- Fastest current Claude model, built for high-volume, latency-sensitive work.
- Cheap: from $0.10 per million input tokens and $0.50 per million output tokens. One conversation turn costs a small fraction of a cent.
- Supports **structured outputs**, so every reply comes back as strict JSON: Chinese characters, pinyin, English, feedback, three suggested replies, and which scenario goals you've completed. The app never has to guess how to parse it.

The key is used **only by the backend**.

---

## 1. Create a Console account and add credit

1. Go to **platform.claude.com** and sign up (this is the developer Console, separate from a claude.ai chat subscription).
2. **Settings > Billing**: add a payment method and buy credits. The minimum top-up is plenty for the hackathon.
3. Recommended: **Settings > Limits**: set a monthly **spend limit** (for example $10) so a bug in a loop can't run up a bill.

## 2. Create an API key

1. **Settings > API Keys** > **Create Key**.
2. Name: `naviglot-backend` (default workspace is fine).
3. Copy the key (starts with `sk-ant-`). It's only shown once.
4. Save it in your scratch note as `ANTHROPIC_API_KEY`.

## 3. Test the key from PowerShell

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-paste_your_key"

$headers = @{
  "x-api-key"         = $env:ANTHROPIC_API_KEY
  "anthropic-version" = "2023-06-01"
}
$body = @{
  model      = "claude-haiku-5-5"
  max_tokens = 300
  messages   = @(@{ role = "user"; content = "Teach me how to say 'one bowl of beef noodles' in Mandarin. Give pinyin." })
} | ConvertTo-Json -Depth 5

$r = Invoke-RestMethod -Uri "https://api.anthropic.com/v1/messages" -Method Post `
  -Headers $headers -ContentType "application/json; charset=utf-8" -Body $body
$r.content | Where-Object { $_.type -eq "text" } | ForEach-Object { $_.text }
```

You should see an answer mentioning 牛肉面 (niúròu miàn). If Chinese characters show as boxes or question marks, that's just the Windows console font; the API worked.

Errors:

- **401**: wrong key.
- **400 "credit balance is too low"**: add credit in Billing.
- **404 model not found**: check the model name is exactly `claude-haiku-5-5`.

## 4. Settings the backend uses (for reference)

You don't need to do anything here; Claude Code builds it. Good to know if you tweak it later:

| Setting | Value | Why |
|---|---|---|
| Model | `claude-haiku-5-5` (env `ANTHROPIC_MODEL`) | Fast and cheap. Swap to `claude-sonnet-5-5` if you want smarter corrections. |
| Effort | `low` | Lowest latency; right for short conversational turns. |
| Structured output | JSON schema via `output_config.format` | Guaranteed shape for the app. |
| `temperature`, `top_p`, `top_k` | **Not sent** | Claude Haiku 5.5 rejects requests that set them. |
| `max_tokens` | about 2000 | Thinking counts toward this limit, so leave room. |

---

Done when: you have `ANTHROPIC_API_KEY` saved and the PowerShell test printed a reply.
