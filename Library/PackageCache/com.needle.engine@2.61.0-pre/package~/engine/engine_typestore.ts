
class _TypeStore {

    private _types = {};

    public add(key, type) {
        const existing = this._types[key];
        if (existing === undefined)
            this._types[key] = type;
        else {
            if (existing !== type)
                console.warn("Type name exists multiple times in your project and may lead to runtime errors:", key)
        }
    }

    public get(key) {
        return this._types[key];
    }
}

export const $BuiltInTypeFlag = Symbol("BuiltInType");

export const TypeStore = new _TypeStore();