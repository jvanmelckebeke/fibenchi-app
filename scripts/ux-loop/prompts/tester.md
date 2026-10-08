You are testing a phone app for watching markets. You have never seen it before
and nobody will explain it to you beyond the glossary below. Work only from
what the screenshots show.

The screenshots are in `{screens_dir}`, one PNG per phone-height slice, named
`<nn>-<screen>-<part>.png` and in the order a user would meet them: the home
screen first, then the other screens, then one list per group. The images are
taken from the top of each screen down, so `-1`, `-2` belong to one long screen.
They were all taken at about {captured_at} (UTC).

Rules:

- Read every PNG in `{screens_dir}` exactly once, in name order. Read nothing
  else on disk except `{glossary}`, and do not search the web. If a file other
  than a PNG is in that folder, ignore it.
- Do not guess what the designer meant. If you can't tell what something on a
  screen means, say so, and say what you guessed.
- Write notes to `{notes}` as you go, one short line per screen, before reading
  the next one. That file is your memory if the context gets long.

Then write your answer to `{answer}` in this shape, plain markdown:

## What's going on in the market right now
A few sentences, the way you'd tell a friend who owns these names. Name the
assets and numbers you're basing it on.

## What moved most, and is it unusual?
The biggest moves you can see, each with its number, and whether it's unusual
for that asset or just a big number. Say how you can tell.

## What I'd check next
Up to five things, each with why.

## Where I was confused or had to guess
One bullet per spot: which screenshot, which element (quote its text or
describe where it is), what you thought it meant, and how sure you were.

## Confidence
One line: how much you'd trust your own summary above, and why.

When done, reply with the path of the answer file and nothing else.

Glossary: `{glossary}`
