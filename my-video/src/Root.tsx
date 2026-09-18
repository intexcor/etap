import "./index.css";
import {Composition} from "remotion";
import {z} from "zod";
import {LessonVideo, lessonVideoSchema} from "./LessonVideo";
import {WhySkyIsBlue, FPS, DURATION_IN_FRAMES} from "./WhySkyIsBlue";

const exampleLesson = {title: "Как работает фотосинтез", hook: "Растения превращают свет в энергию — буквально строят пищу из воздуха.", keyPoints: ["Хлорофилл поглощает энергию солнечного света.", "Вода расщепляется, а энергия запасается в химических связях.", "Углекислый газ превращается в глюкозу — топливо для роста."], takeaway: "Фотосинтез связывает энергию Солнца, воздух и жизнь на Земле.", sourceName: "Демонстрационный материал"};

export const RemotionRoot: React.FC = () => <><Composition id="LessonFromPdf" component={LessonVideo} durationInFrames={1800} fps={30} width={1080} height={1920} schema={lessonVideoSchema} defaultProps={exampleLesson satisfies z.infer<typeof lessonVideoSchema>} /><Composition id="WhySkyIsBlue" component={WhySkyIsBlue} durationInFrames={DURATION_IN_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{titleText: "Welcome to Remotion", titleColor: "#000000", logoColor1: "#91EAE4", logoColor2: "#86A8E7"}} /></>;
