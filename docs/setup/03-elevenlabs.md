# 03. ElevenLabs (the character's voice + hearing you)

Lingvoyage uses two ElevenLabs APIs, both called **only from the backend**:

| What | Model | Used for |
|---|---|---|
| Text to Speech | `eleven_flash_v2_5` | The character speaks Mandarin. Fast (~75 ms model latency) and half the per-character price of the bigger models. Supports Chinese. |
| Speech to Text | `scribe_v2` | Turns your recorded voice into text (Mandarin, English or a mix). |

If you want a richer voice later, switch the TTS model to `eleven_multilingual_v2` with one environment variable. No code change.

---

## 1. Create an account

Go to **elevenlabs.io** > **Sign up**. The free plan gives **10,000 credits per month**, which is plenty for building and a demo if you're careful (see "Saving credits" below).

The free plan doesn't include a commercial license. That's fine for a class project.

## 2. Create a restricted API key

1. Go to **elevenlabs.io/app/settings/api-keys** (or: bottom-left of the dashboard > **Developers** > **API Keys**).
2. **Create API Key**.
   - Name: `lingvoyage-backend`
   - Turn **Restrict Key** on, then set:
     - **Text to Speech**: Access
     - **Speech to Text**: Access
     - **Voices**: Read (lets the backend check your voice exists)
     - Everything else: No Access
   - Optional: set a **credit limit** for this key (for example 8,000 per month) so a bug can't burn your whole quota.
3. **Create**, then **copy the key immediately**. It starts with `sk_` and is only shown once.
4. Save it in your scratch note as `ELEVENLABS_API_KEY`.

Never put this key in the mobile app or commit it to GitHub. Anyone with it can spend your credits.

## 3. Choose a voice (and get its Voice ID)

This is the one place the free plan matters:

> **Free plan:** ElevenLabs does not let free accounts use **Voice Library** (community) voices through the API. The request fails with HTTP 402 `paid_plan_required`. Use one of the **default voices** that come with every account instead.
>
> **Starter plan (about $5/month):** you can use Voice Library voices, including native Mandarin speakers.

### Option A: free plan, default voice

1. Left sidebar > **Voices**.
2. Open the tab that lists the **default** (premade) voices.
3. Pick one, click it (or its "..." menu) and **Copy voice ID**.

Default voices are multilingual and will speak Mandarin, though some sound slightly accented. Try two or three in step 4 and keep the clearest.

### Option B: Starter plan, native Mandarin voice

1. **Voices** > **Voice Library** (Explore).
2. Filter **Language: Chinese**, and look for "Mandarin" / "Standard" accent.
3. Preview, then **Add to my voices**.
4. In **My Voices**, open it > **Copy voice ID**.

Optional: pick three different voices, one per character (noodle-shop owner, station staff, hotel manager). The backend supports one default voice plus per-scenario overrides.

Save the ID(s) in your scratch note as `ELEVENLABS_VOICE_ID` (and optionally `ELEVENLABS_VOICE_ID_RESTAURANT`, `..._TRAIN`, `..._HOTEL`).

## 4. Hear it in the browser first

1. Left sidebar > **Text to Speech**.
2. Choose your voice and the model **Eleven Flash v2.5**.
3. Paste: `你好，欢迎光临！请问几位？` and click **Generate**.

If it sounds good here, it will sound the same in the app.

## 5. Test your key from PowerShell

This checks that the key, its permissions and the voice ID all work via the API (the same way the backend will call it). Use English text here; Chinese characters can get mangled by the Windows console.

```powershell
$env:ELEVENLABS_API_KEY = "sk_paste_your_key"
$env:ELEVENLABS_VOICE_ID = "paste_voice_id"

$headers = @{ "xi-api-key" = $env:ELEVENLABS_API_KEY }
$body = @{ text = "Hello from Lingvoyage. Ni hao!"; model_id = "eleven_flash_v2_5" } | ConvertTo-Json
# Resolves the real Desktop even when OneDrive has moved it
$out = Join-Path ([Environment]::GetFolderPath("Desktop")) "lingvoyage-test.mp3"

Invoke-RestMethod `
  -Uri "https://api.elevenlabs.io/v1/text-to-speech/$($env:ELEVENLABS_VOICE_ID)?output_format=mp3_44100_64" `
  -Method Post -Headers $headers -ContentType "application/json" -Body $body `
  -OutFile $out

Start-Process $out
```

Results:

- An MP3 plays: you're done.
- **401**: wrong or mistyped key.
- **402 `paid_plan_required`**: you picked a Voice Library voice on the free plan. Use a default voice (Option A).
- **403 / missing permission**: edit the key and give **Text to Speech** access.
- **404 voice not found**: wrong Voice ID.

Once the backend is built, `python scripts/check_keys.py` (Claude Code creates it) tests Text to Speech **and** Speech to Text with your real `.env`.

## 6. Saving credits

Credits are spent per character of generated speech (Flash models cost about half as much per character), and transcription draws from the same plan. Ways the app is designed to save them:

- The character's lines are kept short (one or two sentences at beginner level).
- Key-phrase audio on the prep screen is **cached on the phone** after the first play.
- **Slow replay** is done by slowing playback on the phone, so it costs nothing.
- Typing instead of speaking skips Speech to Text.

Check **Usage** in the ElevenLabs dashboard after an hour of testing to see your burn rate. If you're going to run out before demo day, the Starter plan is the cheapest fix.

## 7. Why not the ElevenLabs real-time voice agent?

ElevenLabs also offers live, interruptible voice agents (ElevenAgents). Their React Native SDK depends on native WebRTC code that Expo Go doesn't include, so it needs a custom development build. That's a great upgrade after the hackathon. For now, push-to-talk (record, send, hear the reply) works in Expo Go and gives the same "talk to a character" experience.

---

Done when: you have `ELEVENLABS_API_KEY` and at least one `ELEVENLABS_VOICE_ID`, and the PowerShell test played audio.
