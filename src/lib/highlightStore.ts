/**
 * Revision marks. They live inside the `.mari` file (see mariBundle) — this
 * module only describes their shape.
 */
export interface StoredHighlight {
  from: number;
  to: number;
  stateId: string;
  id: string;
}
