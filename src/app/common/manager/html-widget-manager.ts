import { TransitionLayerService } from "app/components/transition-layer/transition-layer.service";

export class HTMLWidgetManager {
  static shadow: ShadowRoot;
  static init() {
    console.log("Init shadow root");
    
    if (!this.shadow) {
      this.shadow = document
        .querySelector("#avg-widget-layer #widget-layer")
        .attachShadow({ mode: "open" });
    }
  }

  static getShadowRoot() {
    return this.shadow;
  }
}
