import { loadFont as loadSerif } from "@remotion/google-fonts/NotoSerifSC";
import { loadFont as loadSans } from "@remotion/google-fonts/NotoSansSC";

const serif = loadSerif("normal", { weights: ["500", "700"], subsets: ["latin"] });
const sans = loadSans("normal", { weights: ["300", "400", "500"], subsets: ["latin"] });

export const DISPLAY = `${serif.fontFamily}, "Noto Serif CJK SC", "Noto Sans CJK SC", serif`;
export const BODY = `${sans.fontFamily}, "Noto Sans CJK SC", sans-serif`;
