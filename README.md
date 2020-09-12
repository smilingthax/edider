edider: Tools for editing edid files
====================================

1. Convert edid files from/to JS objects and JSON.

Usage:
```sh
show.js edid.hex|edid.bin

edid2json.js edid.hex|edid.bin > edid.json

json2edid.js edid.json > edid.hex

```

NOTE:
 * No validation of parameter values takes place.
 * Unknown / Unimplemented descriptors / extensions are kept as verbatim Buffer (so they round-trip properly).


2. `lib/` also contains DMT, GMT and CVT timing tables / calculators, but there is no command-line tool for them yet.


Copyright (c) 2020 Tobias Hoffmann

License: https://opensource.org/licenses/MIT

