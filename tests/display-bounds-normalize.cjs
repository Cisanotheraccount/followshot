// Remove only the exact separately tested display-boundary stylesheet tag.
const boundsTag='<link rel="stylesheet" href="display-bounds.css?v=20261027-bounds-1">';
const normalizeBoundsHTML=html=>html.replace(boundsTag,'');
module.exports={boundsTag,normalizeBoundsHTML};
