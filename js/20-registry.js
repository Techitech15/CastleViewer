"use strict";

/* ====================================================================
 * 2. castle registry — add more entries here to extend the viewer.
 *    Each entry's build(THREE) must return
 *    { group, fadeGroups, interiorGroup, info, pickables, labelGroup,
 *      windowMat, waterMats }.
 *
 *    Country fields are DATA, not UI strings baked into markup: the info
 *    panel (#castleMeta), the castle <select> options, and any future
 *    surface all read `country` / `countryJa` / `flag` off the registry
 *    entry (see applyCastle below) so adding a castle here is enough --
 *    no template/markup edits needed elsewhere.
 *      country   : English country name (short, for reference)
 *      countryJa : Japanese country name as shown in the UI
 *      flag      : flag emoji shown next to countryJa
 *      year      : construction year, plain number-as-string (UI appends 年)
 *
 *    A castle with its own square moat can build one via
 *    buildWaterMoatSystem()/buildCircularSkirt() (section 0.5, castle-
 *    agnostic) rather than hand-rolling ground/island/bank/water meshes
 *    -- see buildBodiam's "moat, graded bank, island, approaches" block
 *    for the call shape. A castle with a different water layout (circular
 *    moat, dry ditch, hilltop/no moat) can skip that helper and build its
 *    own environment meshes into its own `group` instead.
 * ==================================================================== */
var CASTLES = [];
function registerCastle(def){ CASTLES.push(def); }
// 今後の拡張: 他の城を追加する場合はここに { id, name, nameJa, country,
// countryJa, flag, year, description, build, view } を追加するだけでよい。
// 切替ロジック(applyCastle)と国表示は汎用化されているため、レジストリに
// 追加すれば自動的にUIに反映される。view を省略した場合はボディアムの
// 既定値(20/150/105/90/320/60/220, camFar 1000, panLimit 40, envScale 1,
// envLift 0)にフォールバックする。
