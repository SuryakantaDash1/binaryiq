import { z } from 'zod';

// ─── Category schema JSONB shape ───
export interface CategoryQuestion {
  key: string;
  type: 'text' | 'number' | 'select' | 'radio' | 'multiselect' | 'checkbox' | 'date';
  label: string;
  required?: boolean;
  min?: number;
  max?: number;
  maxSelections?: number;
  options?: Array<{ value: string; label: string }>;
}

export interface CategorySchema {
  version: number;
  questions: CategoryQuestion[];
}

/** Build a Zod schema from a CategorySchema (shared: client + server). */
export function schemaToZod(schema: CategorySchema): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const q of schema.questions) {
    let field: z.ZodTypeAny;
    switch (q.type) {
      case 'number':
        field = z.coerce.number();
        if (q.min !== undefined) field = (field as z.ZodNumber).min(q.min);
        if (q.max !== undefined) field = (field as z.ZodNumber).max(q.max);
        break;
      case 'multiselect':
        field = z.array(z.string());
        if (q.maxSelections !== undefined) field = (field as z.ZodArray<z.ZodString>).max(q.maxSelections);
        break;
      case 'checkbox':
        field = z.boolean();
        break;
      case 'date':
        field = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
        break;
      default:
        field = z.string();
        if (q.options?.length) {
          field = z.enum(q.options.map((o) => o.value) as [string, ...string[]]);
        }
    }
    if (!q.required) field = field.optional();
    shape[q.key] = field;
  }
  return z.object(shape);
}

export const submitCategoryResponseSchema = z.object({
  answers: z.record(z.unknown()),
});
export type SubmitCategoryResponseInput = z.infer<typeof submitCategoryResponseSchema>;
