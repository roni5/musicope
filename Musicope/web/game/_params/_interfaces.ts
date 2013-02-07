module IGame {

  export interface IParamsData {

    // controllers
    c_songUrl: string;
    c_idevice: string;
    c_iscene: string;
    c_iplayer: string;
    c_iparser: string;
    c_callbackUrl: string;

    // players
    p_deviceIn: string;
    p_deviceOut: string;
    p_elapsedTime: number;
    p_initTime: number;
    p_isPaused: bool;
    p_minNote: number;
    p_maxNote: number;
    p_radiuses: number[];
    p_speed: number;
    p_sustain: bool;
    p_userHands: bool[];
    p_volumes: number[];
    p_waits: bool[];

    // metronomes
    m_velocity: number;
    m_id1: number;
    m_id2: number;
    m_channel: number;
    m_ticksPerBeat: number;

    // scenes
    s_views: string[];
    s_quartersPerHeight: number;
    s_colWhites: string[];
    s_colBlacks: string[];
    s_colTime: string;
    s_colPianoWhite: string;
    s_colPianoBlack: string;
    s_colSustain: string;
    s_colPaused: string;
    s_colUnPaused: string;

    // parsers
    f_normalize: number;
    f_trackIds: number[];
  }

  export interface IParams {
    readOnly: IParamsData;
    subscribe(regex: string, callback: (name: string, value: any) => void ): void;
    setParam(name: string, value: any): void;
    areEqual(param1: any, param2: any): bool;
  }

  export interface IParamsNew {
    new (): IParams;
  }
}