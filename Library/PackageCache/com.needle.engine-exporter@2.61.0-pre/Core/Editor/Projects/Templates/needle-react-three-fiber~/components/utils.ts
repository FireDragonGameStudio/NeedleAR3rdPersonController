

export function getName(types: any[]) {
    return types.map((type) => type.name).join(" ");
}