# Setting it up — once

Everything below is done by you, in a browser. **No key, token or password
should ever be pasted into a chat, a file or a commit.** They all live in
Netlify's environment variables and nowhere else.

## 1. The repo

1. Create an empty repo on GitHub — private is fine, and probably right.
2. Push this folder to it.
3. Netlify → Add new project → Import from Git → pick the repo.
   * Build command: `python3 tools/build.py`
   * Publish directory: `.`
   Both are already in `netlify.toml`, so it should offer them.

From here every push deploys itself. That is the point of the move — a dropped
zip runs no `npm install`, and push notifications, the subscription store and
the Instagram token refresh all need packages.

## 2. Push keys

On your machine, once:

    npx web-push generate-vapid-keys

It prints a public and a private key. In Netlify → Site configuration →
Environment variables:

    VAPID_PUBLIC    = the public key
    VAPID_PRIVATE   = the private key
    VAPID_SUBJECT   = mailto:info@farmhousegetaways.com

The public one is meant to be public — the app fetches it. The private one is
what proves a notification came from you. If it ever leaks, generate a new pair
and every existing subscription dies, so people have to opt in again.

## 3. Admin password

    ADMIN_PASSWORD  = something long that is not used anywhere else

Every admin function compares against this in constant time. The browser keeps
it in sessionStorage, so it is gone when the tab closes. It is a shared
password: it cannot tell Cory from Carissa, and anyone reading over a shoulder
has it. Fine for two people; not fine if this ever holds customer data.

## 4. Instagram

The account must be Business or Creator — @minibarnmarket already is.

1. developers.facebook.com → create an app → add **Instagram** →
   **API setup with Instagram login**.
2. Generate a long-lived token with `instagram_business_basic`.
3. `IG_TOKEN = that token`

`instagram-refresh` rolls it every Monday and parks the fresh one in Netlify
Blobs, so it should never expire again.

## 5. The email list

The More screen has a signup that adds people to EmailOctopus. Same one list
the three websites feed — one list for all brands, told apart by tags, because
EmailOctopus bills per contact per list.

    EMAILOCTOPUS_API_KEY       = the key from EmailOctopus → Integrations & API
    EMAILOCTOPUS_LIST_ID       = the list's id
    EMAILOCTOPUS_BRAND         = farmhousegetaways        (optional, this is the default)
    EMAILOCTOPUS_AUTOMATION_ID = the welcome automation's id   (optional)

The first two are the same values the farmhousegetaways site uses. Get them
there once and paste them here too.

Signups from the app are tagged `farmhousegetaways`, `app` and
`source-app-more`. The app is really all three brands at once, but a contact
with no brand tag would be quietly left out of every branded send, so it
carries one — change `EMAILOCTOPUS_BRAND` if you would rather it counted as
`minibarnmarket` or `farmstandtv`.

`EMAILOCTOPUS_AUTOMATION_ID` starts the welcome email that carries the map.
Leave it unset if the automation already triggers on joining the list; setting
both would send the welcome twice. The three emails and how to build them are
in the farmhousegetaways repo under `emails/`.

Until these are set the form politely says signups are not switched on yet, and
the lost address is printed in the function log.

## 6. Check it

Open `/admin`, sign in. The "Is it switched on?" list turns green as each piece
lands. Then install the app on your own phone, turn notifications on, and use
**Send one now** to check it arrives.

## What happens after that

`push-watch` runs every fifteen minutes. The first time it runs it records
whatever is newest and stays quiet — otherwise switching it on would push a
notification about a post from March. From then on, a new post means every
installed phone hears about it within about fifteen minutes.

It only ever announces the newest post per run. Four uploads in a row is four
notifications in ninety seconds, which is how an app gets deleted.

## The iPhone thing

Safari only gives push to a page that has been **added to the home screen**.
Until someone does that, the button on the Today screen hides itself and
explains why. Android and desktop just ask. This is Apple's rule, not ours, and
there is no way around it — which is also why the install ask has to earn its
keep before the notification ask appears.
