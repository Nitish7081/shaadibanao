# Cloudinary photo privacy: dashboard setup

Source: <https://cloudinary.com/documentation/control_access_to_media> (names below are taken from it).

## What the code does (branch `photo-signed-blur`)

- Private photos (`blurred`, or `after_interest_accepted` before acceptance) are sent by the server
  as a **signed** URL (`sign_url: true`) with `e_blur:2000,q_auto,f_auto,w_320` baked in:
  `https://res.cloudinary.com/<cloud>/image/upload/s--SIG--/e_blur:2000,q_auto,f_auto,w_320/v<ver>/<id>.<ext>`
- The signature covers the transformation + public id. Edit or remove the blur => signature mismatch => 401.
- No API secret => the server sends **no URL** (never the original). The secret is never logged.
- The mobile helper `cloudinaryUrl()` never touches signed URLs.

## Dashboard settings YOU must change (manual)

1. **Enable Strict Transformations**
   Console -> **Settings -> Security** (<https://console.cloudinary.com/app/settings/security>) ->
   turn on **Strict Transformations**.
   With it on, a transformation works only if it is: signed, eager, or allow-listed.
   Leave **Allowed strict referral domains** empty (it is for websites, not for a mobile app).
2. **Allow-list the 4 display presets** (otherwise ordinary photos return 404 once strict is on).
   Console -> **Image -> Manage Transformations** (<https://console.cloudinary.com/app/image/manage/>)
   -> Named Transformations or **Log** tab -> row menu -> toggle **Allowed for strict transformations**.
   (Admin API alternative: `PUT /transformations/<transformation>` with `allowed_for_strict=true`.)
   Exact strings (matching is exact, **parameter order matters**):

   | Preset | Transformation |
   |---|---|
   | avatar | `f_auto,q_auto,w_200,h_200,c_fill,g_face` |
   | card | `f_auto,q_auto,w_600,h_750,c_fill,g_face` |
   | hero | `f_auto,q_auto,w_1080,h_1350,c_fill,g_face` |
   | post | `f_auto,q_auto,w_900,c_limit` |

   A transformation shows in the Log only after it has been requested once. Do this **before** turning on
   strict: open one photo per preset in the app, then allow-list them in the Log tab. (Strict off => works;
   afterwards switch strict on.) `f_auto` allows all auto format variants.
3. **Blur transformation: no allow-listing needed**, because the server signs it.
4. Do not enable *Restricted media types -> Fetched URL*; it does not apply here.

## Important limit (please read)

Profile photos are stored as public `upload` assets. For those, Cloudinary always serves the
**original** (`/image/upload/v.../id.jpg`) with no signature, and strict transformations do not block it.
So someone who already knows a photo's public id could still build the original URL. The server does not
send `publicId` or the original URL for locked photos, so this only matters for ids learned earlier / from
an unlocked view.

Real fix (not done in this branch, needs your go-ahead because stored URLs change): upload profile photos
as `private` or `authenticated` and move existing ones with the Admin **Rename** API (`to_type`), then
update the stored `url` values and serve ordinary photos as server-signed URLs too. The server code here
already keeps the asset type (`upload` / `private` / `authenticated`) when signing.
