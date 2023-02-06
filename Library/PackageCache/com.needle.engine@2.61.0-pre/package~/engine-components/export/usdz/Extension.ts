import { USDZObject } from "./types";


export interface IUSDZExporterExtension {

    get extensionName(): string;
    onBeforeBuildDocument?(context);
    onAfterBuildDocument?(context);
    onExportObject?(object, model : USDZObject, context);
    onAfterSerialize?(context);
    onAfterHierarchy?(context);
}