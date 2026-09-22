// address-snapshot.schema.ts
import { z } from 'zod';
import { addressSchema } from './addressSchemas'; 


export const addressSnapshotSchema = addressSchema.omit({ type: true });

export type AddressSnapshot = z.infer<typeof addressSnapshotSchema>;  