# 01. Windows dev environment + iPhone (Expo Go)

You're developing on Windows and testing on an iPhone through Expo Go. You don't need a Mac or Xcode for any of this.

All commands below are for **PowerShell** (Start menu, type "PowerShell"). When a step says "run as administrator", right-click PowerShell and choose **Run as administrator**.

---

## 1. Install the tools

`winget` comes with Windows 10/11 and installs everything in one go:

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
winget install --id Python.Python.3.13 -e
winget install --id Microsoft.VisualStudioCode -e
```

Close PowerShell and open a new window (so the new PATH is picked up), then check:

```powershell
node -v        # v22.x or v24.x is ideal. Must be at least 20.19.4
npm -v
git --version
py -3.13 --version   # Python 3.13.x
code --version
```

If you'd rather use installers: Node from nodejs.org (LTS button), Python from python.org (tick **"Add python.exe to PATH"** on the first screen), Git from git-scm.com.

Why Python 3.13: it's the same version you'll pick on AWS Lambda, so what works on your PC works in the cloud.

## 2. Allow PowerShell to run local scripts

Python virtual environments and some npm tools use `.ps1` scripts that Windows blocks by default. Run once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Answer `Y`.

## 3. Set your Wi-Fi to "Private"

Your iPhone needs to reach your PC over Wi-Fi. Windows blocks most incoming connections on "Public" networks.

1. Settings > Network & internet > Wi-Fi > click your network.
2. **Network profile type: Private network**.

The first time Node or Python starts a server, Windows Defender Firewall asks for permission. Tick **Private networks** and click **Allow**.

## 4. Find your PC's local IP address

```powershell
ipconfig
```

Under **Wireless LAN adapter Wi-Fi**, copy the **IPv4 Address** (looks like `192.168.1.23` or `10.0.0.15`). Save it in your scratch note as `YOUR_PC_LAN_IP`. It can change when you reconnect to Wi-Fi, so re-check it if the app suddenly can't reach the backend.

## 5. Clone your repo and add these docs

```powershell
cd $HOME\Documents
git clone https://github.com/<your-username>/<your-repo>.git lingvoyage
cd lingvoyage
```

Copy the `docs` folder (the one this guide is in) into the root of the repo, then:

```powershell
git add docs
git commit -m "Add setup guides and architecture"
git push
```

## 6. VS Code + Claude Code

1. Open the repo: `code .`
2. Extensions panel (Ctrl+Shift+X) > search **Claude Code** > Install (publisher: Anthropic).
3. Click the Claude icon in the sidebar and sign in.
4. Also handy: **Python** (Microsoft) and **Expo Tools** extensions.

Optional but recommended: Expo publishes official skills that teach Claude Code current Expo patterns. In the Claude Code chat, run:

```
/plugin marketplace add expo/skills
/plugin install expo
```

## 7. iPhone: Expo Go

1. Install **Expo Go** from the App Store.
2. Create a free account at **expo.dev** (Sign up). Use the same account for the whole team or one each; either works.
3. In Expo Go, tap the avatar in the top right and **log in**.

Since September 2026, Expo Go on iOS only opens your dev project if you're **logged in with the same Expo account in both the Expo Go app and the terminal**. You'll do the terminal side (`npx expo login`) in guide 06, once the project exists.

4. Keep the iPhone on **the same Wi-Fi network** as your PC.

### Check which Expo SDK your Expo Go supports

Expo Go from the App Store only runs one SDK version at a time. As of October 12, 2026 that's **SDK 57**. SDK 58 is in beta and Expo Go will switch to it shortly after its stable release.

The Claude Code prompt creates the project with `--template default@sdk-57`. If, when you first open the app, Expo Go says the project is incompatible and needs a newer SDK, run this inside `mobile/` and try again:

```powershell
npx expo install expo@latest --fix
```

## 8. Optional: a tunnel tool for tricky Wi-Fi

School and hotel Wi-Fi often blocks devices from talking to each other. If that happens (guide 08 explains how to tell), you have two escape hatches:

- For the app bundle: `npx expo start --tunnel` (built into Expo).
- For the backend: deploy to AWS Lambda (guide 07), or use a free Cloudflare quick tunnel:

```powershell
winget install --id Cloudflare.cloudflared -e
```

You don't need these if your home Wi-Fi works.

---

Done when: `node -v`, `py -3.13 --version` and `git --version` all print versions, Expo Go is installed and logged in, and you've saved your PC's IP address.
