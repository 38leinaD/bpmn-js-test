import { q as query, c as create, b as append, a as attr, p as getMid, u as clear } from '../../common/LayoutUtil-be29d3d9.js';
import { S as SPACING, q as quantize } from '../../common/GridUtil-1b787f19.js';
import '../../common/index.esm-303bc2dc.js';

/**
 * @typedef {import('diagram-js/lib/core/Canvas').default} Canvas
 * @typedef {import('diagram-js/lib/core/EventBus').default} EventBus
 */

var GRID_COLOR = '#ccc',
    LAYER_NAME = 'djs-grid';

var GRID_DIMENSIONS = {
  width: 100000,
  height: 100000
};

/**
 * @param {Canvas} canvas
 * @param {EventBus} eventBus
 */
function Grid(canvas, eventBus) {
  this._canvas = canvas;

  this._visible = false;

  var self = this;

  eventBus.on('diagram.init', function() {
    self._init();
  });

  eventBus.on('gridSnapping.toggle', function(event) {
    var active = event.active;

    self.toggle(active);

    self._centerGridAroundViewbox();
  });

  eventBus.on('canvas.viewbox.changed', function(context) {
    var viewbox = context.viewbox;

    self._centerGridAroundViewbox(viewbox);
  });
}

Grid.prototype._init = function() {
  var defs = query('defs', this._canvas._svg);

  if (!defs) {
    defs = create('defs');

    append(this._canvas._svg, defs);
  }

  var pattern = this._pattern = create('pattern');

  var patternId = 'djs-grid-pattern-' + randomNumber();

  attr(pattern, {
    id: patternId,
    width: SPACING,
    height: SPACING,
    patternUnits: 'userSpaceOnUse'
  });

  var circle = this._circle = create('circle');

  attr(circle, {
    cx: 0.5,
    cy: 0.5,
    r: 0.5,
    fill: GRID_COLOR
  });

  append(pattern, circle);

  append(defs, pattern);

  var grid = this._gfx = create('rect');

  attr(grid, {
    x: -(GRID_DIMENSIONS.width / 2),
    y: -(GRID_DIMENSIONS.height / 2),
    width: GRID_DIMENSIONS.width,
    height: GRID_DIMENSIONS.height,
    fill: `url(#${ patternId })`
  });
};

Grid.prototype._centerGridAroundViewbox = function(viewbox) {
  if (!viewbox) {
    viewbox = this._canvas.viewbox();
  }

  var mid = getMid(viewbox);

  attr(this._gfx, {
    x: -(GRID_DIMENSIONS.width / 2) + quantize(mid.x, SPACING),
    y: -(GRID_DIMENSIONS.height / 2) + quantize(mid.y, SPACING)
  });
};

/**
 * Return the current grid visibility.
 *
 * @return {boolean}
 */
Grid.prototype.isVisible = function() {
  return this._visible;
};

/**
 * Toggle grid visibility.
 *
 * @param {boolean} [visible] new visible state
 */
Grid.prototype.toggle = function(visible) {

  if (typeof visible === 'undefined') {
    visible = !this._visible;
  }

  if (visible === this._visible) {
    return;
  }

  var parent = this._getParent();

  if (visible) {
    append(parent, this._gfx);
  } else {
    clear(parent);
  }

  this._visible = visible;
};

Grid.prototype._getParent = function() {
  return this._canvas.getLayer(LAYER_NAME, -2);
};

Grid.$inject = [
  'canvas',
  'eventBus'
];


// helpers ///////////////

function randomNumber() {
  return Math.trunc(Math.random() * 1000000);
}

var index = {
  __init__: [ 'grid' ],
  grid: [ 'type', Grid ]
};

export { index as default };
