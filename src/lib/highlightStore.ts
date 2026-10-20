/**
 * Revision marks. They live inside the `.mari` file (see mariBundle). This
 * module only describes their shape.
 */
export interface StoredHighlight {
  from: number;
  to: number;
  stateId: string;
  id: string;
}
