export interface ICanvasGroup {
    get isCanvasGroup() : boolean;
    blocksRaycasts: boolean;
    interactable: boolean;
}

export interface IGraphic {
    get isGraphic() : boolean;
    raycastTarget: boolean;
}