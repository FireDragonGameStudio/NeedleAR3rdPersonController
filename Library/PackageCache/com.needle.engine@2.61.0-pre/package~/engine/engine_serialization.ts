import { serializeObject, deserializeObject } from "./engine_serialization_core";
import * as builtin from "./engine_serialization_builtin_serializer";
// export builtin so it will be called and registered
export { serializeObject, deserializeObject, builtin };

export { serializable, serializeable } from "./engine_serialization_decorator"