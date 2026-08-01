import { migrateToLanguageField } from "sanity-plugin-internationalized-array/migrations";

// Document types that contain internationalized-array fields.
const DOCUMENT_TYPES: string[] = ["post", "author", "category", "giftFacet"];

export default migrateToLanguageField(DOCUMENT_TYPES);
