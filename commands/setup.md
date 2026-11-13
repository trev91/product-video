---
description: Check this Mac for what video making needs, and install anything missing (with your OK)
---

Get this Mac ready to make product videos, for a person who is not technical.

1. Run `"${CLAUDE_PLUGIN_ROOT}/skills/product-video/scripts/setup.sh" check` and read the result.
2. If everything is READY, say so in one sentence and ask what video they would like.
3. If something is MISSING, tell the person in plain words what will be added (name each item and
   what it is for, in a few words), that it goes only into a folder in their home directory, that
   it needs no administrator password, roughly how big it is (about 250 MB on disk for both tools), and
   that deleting the `.product-video` folder in their home directory removes it again. Ask for a yes.
4. On yes, run `setup.sh install` (it can take a few minutes) and relay the result the same way.
   If a line says NEEDS-PERSON or an install failed, explain the one thing they need to do, or
   that you could not finish and why. Never ask them to type a command.

Follow the "Working with a non-technical person" section of the product-video skill throughout.
