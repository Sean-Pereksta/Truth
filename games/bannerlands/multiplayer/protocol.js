// A protocol major or game/asset version mismatch is rejected before a seat can
// enter battle. Preview versions deliberately require an exact match.
export const PROTOCOL_VERSION=1;
export const GAME_VERSION='0.3.0-battlefield-preview.2';
export const ASSET_VERSION='eight-facing-battlefield.1';
export const MAX_HUMANS=4;
export const MAX_COMMAND_IDS=12000;
export const COMPATIBILITY=Object.freeze({v:PROTOCOL_VERSION,gameVersion:GAME_VERSION,assetVersion:ASSET_VERSION});
export function compatible(value){return !!value&&value.v===PROTOCOL_VERSION&&value.gameVersion===GAME_VERSION&&value.assetVersion===ASSET_VERSION;}
export function protocolError(message,code='invalid-command'){return {ok:false,code,message};}
