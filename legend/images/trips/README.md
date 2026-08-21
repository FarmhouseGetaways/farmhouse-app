# Trip photos

Photos referenced by `data/places.json` live here. The add/edit form will
shrink a photo in the browser, hand you back the file, and fill in the path —
`images/trips/<name>.jpg`. Drop the file it gave you into this folder and
commit it, and the photo is on the site.

Photos are resized to 1600px on the long edge and re-encoded as JPEG, which
usually lands between 200 and 400 KB. Anything much larger than that is worth
resizing again: a phone photo straight off the camera is several megabytes,
and the map popups show it at a couple of hundred pixels wide.

An external URL works too — paste it into the Photos box instead. It just
means the site depends on somewhere else staying up.
