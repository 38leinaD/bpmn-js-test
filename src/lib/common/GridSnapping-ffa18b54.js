import { a as isArray, e as assign, i as isNumber } from './index.esm-303bc2dc.js';
import { S as SPACING, q as quantize } from './GridUtil-1b787f19.js';

var KEYS_COPY = [ 'c', 'C' ];
var KEYS_PASTE = [ 'v', 'V' ];
var KEYS_REDO = [ 'y', 'Y' ];
var KEYS_UNDO = [ 'z', 'Z' ];

/**
 * Returns true if event was triggered with any modifier
 * @param {KeyboardEvent} event
 */
function hasModifier(event) {
  return (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey);
}

/**
 * @param {KeyboardEvent} event
 * @return {boolean}
 */
function isCmd(event) {

  // ensure we don't react to AltGr
  // (mapped to CTRL + ALT)
  if (event.altKey) {
    return false;
  }

  return event.ctrlKey || event.metaKey;
}

/**
 * Checks if key pressed is one of provided keys.
 *
 * @param {string|string[]} keys
 * @param {KeyboardEvent} event
 * @return {boolean}
 */
function isKey(keys, event) {
  keys = isArray(keys) ? keys : [ keys ];

  return keys.indexOf(event.key) !== -1 || keys.indexOf(event.code) !== -1;
}

/**
 * @param {KeyboardEvent} event
 */
function isShift(event) {
  return event.shiftKey;
}

/**
 * @param {KeyboardEvent} event
 */
function isCopy(event) {
  return isCmd(event) && isKey(KEYS_COPY, event);
}

/**
 * @param {KeyboardEvent} event
 */
function isPaste(event) {
  return isCmd(event) && isKey(KEYS_PASTE, event);
}

/**
 * @param {KeyboardEvent} event
 */
function isUndo(event) {
  return isCmd(event) && !isShift(event) && isKey(KEYS_UNDO, event);
}

/**
 * @param {KeyboardEvent} event
 */
function isRedo(event) {
  return isCmd(event) && (
    isKey(KEYS_REDO, event) || (
      isKey(KEYS_UNDO, event) && isShift(event)
    )
  );
}

/**
 * @typedef {import('../../core/Types').ConnectionLike} Connection
 * @typedef {import('../../core/Types').ShapeLike} Shape
 *
 * @typedef {import('../../core/EventBus').Event} Event
 *
 * @typedef {import('../../util/Types').Axis} Axis
 */

var abs = Math.abs,
    round = Math.round;


/**
 * Snap value to a collection of reference values.
 *
 * @param {number} value
 * @param {Array<number>} values
 * @param {number} [tolerance=10]
 *
 * @return {number} the value we snapped to or null, if none snapped
 */
function snapTo(value, values, tolerance) {
  tolerance = tolerance === undefined ? 10 : tolerance;

  var idx, snapValue;

  for (idx = 0; idx < values.length; idx++) {
    snapValue = values[idx];

    if (abs(snapValue - value) <= tolerance) {
      return snapValue;
    }
  }
}


function topLeft(bounds) {
  return {
    x: bounds.x,
    y: bounds.y
  };
}

function bottomRight(bounds) {
  return {
    x: bounds.x + bounds.width,
    y: bounds.y + bounds.height
  };
}

function mid(bounds, defaultValue) {

  if (!bounds || isNaN(bounds.x) || isNaN(bounds.y)) {
    return defaultValue;
  }

  return {
    x: round(bounds.x + bounds.width / 2),
    y: round(bounds.y + bounds.height / 2)
  };
}


/**
 * Retrieve the snap state of the given event.
 *
 * @param {Event} event
 * @param {Axis} axis
 *
 * @return {boolean} the snapped state
 *
 */
function isSnapped(event, axis) {
  var snapped = event.snapped;

  if (!snapped) {
    return false;
  }

  if (typeof axis === 'string') {
    return snapped[axis];
  }

  return snapped.x && snapped.y;
}


/**
 * Set the given event as snapped.
 *
 * This method may change the x and/or y position of the shape
 * from the given event!
 *
 * @param {Event} event
 * @param {Axis} axis
 * @param {number|boolean} value
 *
 * @return {number} old value
 */
function setSnapped(event, axis, value) {
  if (typeof axis !== 'string') {
    throw new Error('axis must be in [x, y]');
  }

  if (typeof value !== 'number' && value !== false) {
    throw new Error('value must be Number or false');
  }

  var delta,
      previousValue = event[axis];

  var snapped = event.snapped = (event.snapped || {});


  if (value === false) {
    snapped[axis] = false;
  } else {
    snapped[axis] = true;

    delta = value - previousValue;

    event[axis] += delta;
    event['d' + axis] += delta;
  }

  return previousValue;
}

/**
 * Get children of a shape.
 *
 * @param {Shape} parent
 *
 * @return {Array<Shape|Connection>}
 */
function getChildren(parent) {
  return parent.children || [];
}

/**
 * @typedef {import('../../core/ElementRegistry').default} ElementRegistry
 * @typedef {import('../../core/EventBus').default} EventBus
 */

var LOWER_PRIORITY = 1200;
var LOW_PRIORITY = 800;

/**
 * Basic grid snapping that covers connecting, creating, moving, resizing shapes, moving bendpoints
 * and connection segments.
 *
 * @param {ElementRegistry} elementRegistry
 * @param {EventBus} eventBus
 * @param {Object} config
 */
function GridSnapping(elementRegistry, eventBus, config) {

  var active = !config || config.active !== false;

  this._eventBus = eventBus;

  var self = this;

  eventBus.on('diagram.init', LOW_PRIORITY, function() {
    self.setActive(active);
  });

  eventBus.on([
    'create.move',
    'create.end',
    'bendpoint.move.move',
    'bendpoint.move.end',
    'connect.move',
    'connect.end',
    'connectionSegment.move.move',
    'connectionSegment.move.end',
    'resize.move',
    'resize.end',
    'shape.move.move',
    'shape.move.end'
  ], LOWER_PRIORITY, function(event) {
    var originalEvent = event.originalEvent;

    if (!self.active || (originalEvent && isCmd(originalEvent))) {
      return;
    }

    var context = event.context,
        gridSnappingContext = context.gridSnappingContext;

    if (!gridSnappingContext) {
      gridSnappingContext = context.gridSnappingContext = {};
    }

    [ 'x', 'y' ].forEach(function(axis) {
      var options = {};

      // allow snapping with offset
      var snapOffset = getSnapOffset(event, axis, elementRegistry);

      if (snapOffset) {
        options.offset = snapOffset;
      }

      // allow snapping with min and max
      var snapConstraints = getSnapConstraints(event, axis);

      if (snapConstraints) {
        assign(options, snapConstraints);
      }

      if (!isSnapped(event, axis)) {
        self.snapEvent(event, axis, options);
      }
    });
  });
}

/**
 * Snap an events x or y with optional min, max and offset.
 *
 * @param {Object} event
 * @param {string} axis
 * @param {number} [options.min]
 * @param {number} [options.max]
 * @param {number} [options.offset]
 */
GridSnapping.prototype.snapEvent = function(event, axis, options) {
  var snappedValue = this.snapValue(event[ axis ], options);

  setSnapped(event, axis, snappedValue);
};

/**
 * Expose grid spacing for third parties (i.e. extensions).
 *
 * @return {number} spacing of grid dots
 */
GridSnapping.prototype.getGridSpacing = function() {
  return SPACING;
};

/**
 * Snap value with optional min, max and offset.
 *
 * @param {number} value
 * @param {Object} options
 * @param {number} [options.min]
 * @param {number} [options.max]
 * @param {number} [options.offset]
 */
GridSnapping.prototype.snapValue = function(value, options) {
  var offset = 0;

  if (options && options.offset) {
    offset = options.offset;
  }

  value += offset;

  value = quantize(value, SPACING);

  var min, max;

  if (options && options.min) {
    min = options.min;

    if (isNumber(min)) {
      min = quantize(min + offset, SPACING, 'ceil');

      value = Math.max(value, min);
    }
  }

  if (options && options.max) {
    max = options.max;

    if (isNumber(max)) {
      max = quantize(max + offset, SPACING, 'floor');

      value = Math.min(value, max);
    }
  }

  value -= offset;

  return value;
};

GridSnapping.prototype.isActive = function() {
  return this.active;
};

GridSnapping.prototype.setActive = function(active) {
  this.active = active;

  this._eventBus.fire('gridSnapping.toggle', { active: active });
};

GridSnapping.prototype.toggleActive = function() {
  this.setActive(!this.active);
};

GridSnapping.$inject = [
  'elementRegistry',
  'eventBus',
  'config.gridSnapping'
];

// helpers //////////

/**
 * Get minimum and maximum snap constraints.
 * Constraints are cached.
 *
 * @param {Object} event
 * @param {Object} event.context
 * @param {string} axis
 *
 * @return {boolean|Object}
 */
function getSnapConstraints(event, axis) {
  var context = event.context,
      createConstraints = context.createConstraints,
      resizeConstraints = context.resizeConstraints || {},
      gridSnappingContext = context.gridSnappingContext,
      snapConstraints = gridSnappingContext.snapConstraints;

  // cache snap constraints
  if (snapConstraints && snapConstraints[ axis ]) {
    return snapConstraints[ axis ];
  }

  if (!snapConstraints) {
    snapConstraints = gridSnappingContext.snapConstraints = {};
  }

  if (!snapConstraints[ axis ]) {
    snapConstraints[ axis ] = {};
  }

  var direction = context.direction;

  // create
  if (createConstraints) {
    if (isHorizontal(axis)) {
      snapConstraints.x.min = createConstraints.left;
      snapConstraints.x.max = createConstraints.right;
    } else {
      snapConstraints.y.min = createConstraints.top;
      snapConstraints.y.max = createConstraints.bottom;
    }
  }

  // resize
  var minResizeConstraints = resizeConstraints.min,
      maxResizeConstraints = resizeConstraints.max;

  if (minResizeConstraints) {
    if (isHorizontal(axis)) {

      if (isWest(direction)) {
        snapConstraints.x.max = minResizeConstraints.left;
      } else {
        snapConstraints.x.min = minResizeConstraints.right;
      }

    } else {

      if (isNorth(direction)) {
        snapConstraints.y.max = minResizeConstraints.top;
      } else {
        snapConstraints.y.min = minResizeConstraints.bottom;
      }

    }
  }

  if (maxResizeConstraints) {
    if (isHorizontal(axis)) {

      if (isWest(direction)) {
        snapConstraints.x.min = maxResizeConstraints.left;
      } else {
        snapConstraints.x.max = maxResizeConstraints.right;
      }

    } else {

      if (isNorth(direction)) {
        snapConstraints.y.min = maxResizeConstraints.top;
      } else {
        snapConstraints.y.max = maxResizeConstraints.bottom;
      }

    }
  }

  return snapConstraints[ axis ];
}

/**
 * Get snap offset.
 * Offset is cached.
 *
 * @param {Object} event
 * @param {string} axis
 * @param {ElementRegistry} elementRegistry
 *
 * @return {number}
 */
function getSnapOffset(event, axis, elementRegistry) {
  var context = event.context,
      shape = event.shape,
      gridSnappingContext = context.gridSnappingContext,
      snapLocation = gridSnappingContext.snapLocation,
      snapOffset = gridSnappingContext.snapOffset;

  // cache snap offset
  if (snapOffset && isNumber(snapOffset[ axis ])) {
    return snapOffset[ axis ];
  }

  if (!snapOffset) {
    snapOffset = gridSnappingContext.snapOffset = {};
  }

  if (!isNumber(snapOffset[ axis ])) {
    snapOffset[ axis ] = 0;
  }

  if (!shape) {
    return snapOffset[ axis ];
  }

  if (!elementRegistry.get(shape.id)) {

    if (isHorizontal(axis)) {
      snapOffset[ axis ] += shape[ axis ] + shape.width / 2;
    } else {
      snapOffset[ axis ] += shape[ axis ] + shape.height / 2;
    }
  }

  if (!snapLocation) {
    return snapOffset[ axis ];
  }

  if (axis === 'x') {
    if (/left/.test(snapLocation)) {
      snapOffset[ axis ] -= shape.width / 2;
    } else if (/right/.test(snapLocation)) {
      snapOffset[ axis ] += shape.width / 2;
    }
  } else {
    if (/top/.test(snapLocation)) {
      snapOffset[ axis ] -= shape.height / 2;
    } else if (/bottom/.test(snapLocation)) {
      snapOffset[ axis ] += shape.height / 2;
    }
  }

  return snapOffset[ axis ];
}

function isHorizontal(axis) {
  return axis === 'x';
}

function isNorth(direction) {
  return direction.indexOf('n') !== -1;
}

function isWest(direction) {
  return direction.indexOf('w') !== -1;
}

export { GridSnapping as G, isShift as a, isKey as b, isUndo as c, isRedo as d, isCopy as e, isPaste as f, snapTo as g, hasModifier as h, isCmd as i, isSnapped as j, getChildren as k, bottomRight as l, mid as m, setSnapped as s, topLeft as t };
