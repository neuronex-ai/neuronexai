# Notes import status

## Imported in this round

- Notes workspace shell and navigation between the seven current Notes modes.
- Notes list/search/selection/editor surface with local mock data.
- Tasks board with local completion state.
- Files surface with local mock documents.
- Notion entry surface.
- NeuroView, NeuroFlow and NeuroPulse entry surfaces and layout placeholders.
- Light/dark styling for the workspace.
- No Supabase, auth, realtime, Synapse agent execution or production data.

## Still to import

The production `src/pages/Notes.tsx` composes several large modules. The following are intentionally not copied wholesale yet:

- `components/notes/NeuroView` implementation and its graph/data helpers.
- `components/notes/NeuroFlow` implementation and canvas/editor helpers.
- `components/notes/NeuroPulse` implementation and diagram helpers.
- `components/notes/NeuroFlowVault` and its persistence-specific behavior.
- Full `FilesManager` behavior and previews.
- Full `NotionPagesPanel` behavior.
- Full `TaskBoard` behavior and reminder persistence.
- Full `NoteEditor` behavior and rich-text persistence.
- Production Synapse-to-Notes action routing.

## Rule for the next Notes rounds

Do not connect these modules to the production Supabase project. Import visual structure and observable interactions first, replacing persistence and agent calls with local mock state. Keep the `/synapse-ai` desktop page out of the Lab; only the bottom-right Synapse text/voice pill belongs in `neuronext`.
