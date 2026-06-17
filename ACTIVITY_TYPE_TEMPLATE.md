# Activity Type Template

Use this prompt when adding a new activity type to LuraStudy.

---

## Prompt: Add a New Activity Type

```
I want to add a new activity type called "[NAME]" (e.g. "Cloze Deletion", "True/False", "Matching", "Fill-in-the-Blank") to LuraStudy.

## What this activity does
[Describe what it is — e.g. "It shows a sentence with a missing word, and the user fills in the blank."]

## LLM Output Format
The AI should generate JSON like this:
```
{ "[json_root_key]": [
    { "[field1]": "...", "[field2]": "...", ... }
  ]
}
```
[List the exact fields and their types. Mark which are required.]

## Example Item
[Show one concrete example of what a generated item looks like]

## Storage
- Should it use SM-2 spaced repetition (like flashcards)? [Yes/No]
- Should it be stored as Flashcard records with `activity_type="[type_id]"`? [Yes — unless it needs a completely different DB table like Quiz does]

## Spaced Repetition
- If yes, the "front" field is what the user sees, "back" is what they need to recall
- If the item has more complex fields (e.g. multiple blanks, options), describe them
```

---

## Implementation Steps

1. **Backend: Create `backend/app/activities/[type_id].py`**
   - Define a `[TypeId]ActivityType(ActivityType)` class with all fields
   - Export a singleton `[TypeId]Activity = [TypeId]ActivityType()`

2. **Backend: Register in `backend/app/activities/__init__.py`**
   - Add `"[type_id]": [TypeId]Activity` to `ACTIVITY_TYPES`

3. **Frontend: Create `frontend/src/activities/[type_id]/Panel.jsx`**
   - Default export a React component that receives `{ deck, onDeckUpdated }` props
   - Call `generateActivity(deck.id, "[type_id]", { max_items })` to generate
   - Display the items and let the user interact with them

4. **Frontend: Register in `frontend/src/activities/index.js`**
   - Import the panel component
   - Add to `ACTIVITY_COMPONENTS` and `ACTIVITY_METADATA`