import { registerRootComponent } from "expo";
import "@/polyfills/webcrypto";

import App from "@/App";

registerRootComponent(App);
