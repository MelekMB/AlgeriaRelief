# data/communes.json

All 1,545 Algerian communes, covering every one of the 58 wilayas, with the
official commune code, the Arabic name, and a title-cased Latin name.

`npm run seed:geo` loads this file by default. To replace it with a different
dataset:

```bash
npm run seed:geo -- --file path/to/communes.json
```

Shape: `[{ "wilayaCode": "06", "code": "601", "nameAr": "بجاية", "nameFr": "Bejaia" }, ...]`

## Source

Derived from [dzcode-io/leblad](https://github.com/dzcode-io/leblad) (MIT),
a maintained dataset of Algerian administrative divisions. Its wilaya list
predates the 2019 reorganisation, so it carries 48 wilayas; the communes of
the 10 newer southern wilayas still appear under their pre-2019 parent. Each
of those 10 also gets its chef-lieu entry here so no wilaya has an empty
dropdown.

Latin names are title-cased from the source's uppercase spellings. **A native
Algerian speaker should spot-check the wilayas being used in a pilot before
launch** — transliteration varies and the Arabic names matter more to users
than the Latin ones.
