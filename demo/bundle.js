!function(e){"object"==typeof exports?module.exports=e():"function"==typeof define&&define.amd?define(e):"undefined"!=typeof window?window.b=e():"undefined"!=typeof global?global.b=e():"undefined"!=typeof self&&(self.b=e())}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = {
  forceDirected : require('../'),
  generators : require('ngraph.generators')
}

},{"../":5,"ngraph.generators":2}],2:[function(require,module,exports){
module.exports = {
  ladder: ladder,
  complete: complete,
  path: path
};

var createGraph = require('ngraph.graph');

/**
 * Ladder graph is a graph in form of ladder
 * @param n {Number} Represents number of steps in the ladder
 */
function ladder(n) {
  if (!n || n < 0) {
    throw new Error("Invalid number of nodes");
  }

  var g = createGraph(),
      i;

  for (i = 0; i < n - 1; ++i) {
    g.addLink(i, i + 1);
    // first row
    g.addLink(n + i, n + i + 1);
    // second row
    g.addLink(i, n + i);
    // ladder's step
  }

  g.addLink(n - 1, 2 * n - 1);
  // last step in the ladder;

  return g;
}

/**
 * Generates complete graph Kn.
 *
 * @param n {Number}  represents number of nodes in the complete graph.
 */
function complete(n) {
  if (!n || n < 1) {
    throw new Error("At least two nodes are expected for complete graph");
  }

  var g = createGraph(),
      i,
      j;

  for (i = 0; i < n; ++i) {
    for (j = i + 1; j < n; ++j) {
      if (i !== j) {
        g.addLink(i, j);
      }
    }
  }

  return g;
}

/**
 * Generates a path-graph with n steps.
 *
 * @param n {Number} number of nodes in the path
 */
function path(n) {
  if (!n || n < 0) {
    throw new Error("Invalid number of nodes");
  }

  var g = createGraph(),
      i;

  g.addNode(0);

  for (i = 1; i < n; ++i) {
    g.addLink(i - 1, i);
  }

  return g;
}

},{"ngraph.graph":3}],3:[function(require,module,exports){
/**
 * @fileOverview Contains definition of the core graph object.
 */


/**
 * @example
 *  var graph = require('ngraph.graph')();
 *  graph.addNode(1);     // graph has one node.
 *  graph.addLink(2, 3);  // now graph contains three nodes and one link.
 *
 */
module.exports = function () {
    // Graph structure is maintained as dictionary of nodes
    // and array of links. Each node has 'links' property which
    // hold all links related to that node. And general links
    // array is used to speed up all links enumeration. This is inefficient
    // in terms of memory, but simplifies coding.

    var nodes = {},
        links = [],
        // Hash of multi-edges. Used to track ids of edges between same nodes
        multiEdges = {},
        nodesCount = 0,
        suspendEvents = 0,

        // Accumlates all changes made during graph updates.
        // Each change element contains:
        //  changeType - one of the strings: 'add', 'remove' or 'update';
        //  node - if change is related to node this property is set to changed graph's node;
        //  link - if change is related to link this property is set to changed graph's link;
        changes = [],

        fireGraphChanged = function (graph) {
            graph.fire('changed', changes);
        },

        // Enter, Exit Mofidication allows bulk graph updates without firing events.
        enterModification = function () {
            suspendEvents += 1;
        },

        exitModification = function (graph) {
            suspendEvents -= 1;
            if (suspendEvents === 0 && changes.length > 0) {
                fireGraphChanged(graph);
                changes.length = 0;
            }
        },

        recordNodeChange = function (node, changeType) {
            changes.push({node : node, changeType : changeType});
        },

        recordLinkChange = function (link, changeType) {
            changes.push({link : link, changeType : changeType});
        },
        linkConnectionSymbol = '👉 ';

    var graphPart = {

        /**
         * Adds node to the graph. If node with given id already exists in the graph
         * its data is extended with whatever comes in 'data' argument.
         *
         * @param nodeId the node's identifier. A string or number is preferred.
         *   note: Node id should not contain 'linkConnectionSymbol'. This will break link identifiers
         * @param [data] additional data for the node being added. If node already
         *   exists its data object is augmented with the new one.
         *
         * @return {node} The newly added node or node with given id if it already exists.
         */
        addNode : function (nodeId, data) {
            if (typeof nodeId === 'undefined') {
                throw new Error('Invalid node identifier');
            }

            enterModification();

            var node = this.getNode(nodeId);
            if (!node) {
                // TODO: Should I check for linkConnectionSymbol here?
                node = new Node(nodeId);
                nodesCount++;

                recordNodeChange(node, 'add');
            } else {
                recordNodeChange(node, 'update');
            }

            node.data = data;

            nodes[nodeId] = node;

            exitModification(this);
            return node;
        },

        /**
         * Adds a link to the graph. The function always create a new
         * link between two nodes. If one of the nodes does not exists
         * a new node is created.
         *
         * @param fromId link start node id;
         * @param toId link end node id;
         * @param [data] additional data to be set on the new link;
         *
         * @return {link} The newly created link
         */
        addLink : function (fromId, toId, data) {
            enterModification();

            var fromNode = this.getNode(fromId) || this.addNode(fromId);
            var toNode = this.getNode(toId) || this.addNode(toId);

            var linkId = fromId.toString() + linkConnectionSymbol + toId.toString();
            var isMultiEdge = multiEdges.hasOwnProperty(linkId);
            if (isMultiEdge || this.hasLink(fromId, toId)) {
                if (!isMultiEdge) {
                    multiEdges[linkId] = 0;
                }
                linkId += '@' + (++multiEdges[linkId]);
            }

            var link = new Link(fromId, toId, data, linkId);

            links.push(link);

            // TODO: this is not cool. On large graphs potentially would consume more memory.
            fromNode.links.push(link);
            toNode.links.push(link);

            recordLinkChange(link, 'add');

            exitModification(this);

            return link;
        },

        /**
         * Removes link from the graph. If link does not exist does nothing.
         *
         * @param link - object returned by addLink() or getLinks() methods.
         *
         * @returns true if link was removed; false otherwise.
         */
        removeLink : function (link) {
            if (!link) { return false; }
            var idx = indexOfElementInArray(link, links);
            if (idx < 0) { return false; }

            enterModification();

            links.splice(idx, 1);

            var fromNode = this.getNode(link.fromId);
            var toNode = this.getNode(link.toId);

            if (fromNode) {
                idx = indexOfElementInArray(link, fromNode.links);
                if (idx >= 0) {
                    fromNode.links.splice(idx, 1);
                }
            }

            if (toNode) {
                idx = indexOfElementInArray(link, toNode.links);
                if (idx >= 0) {
                    toNode.links.splice(idx, 1);
                }
            }

            recordLinkChange(link, 'remove');

            exitModification(this);

            return true;
        },

        /**
         * Removes node with given id from the graph. If node does not exist in the graph
         * does nothing.
         *
         * @param nodeId node's identifier passed to addNode() function.
         *
         * @returns true if node was removed; false otherwise.
         */
        removeNode: function (nodeId) {
            var node = this.getNode(nodeId);
            if (!node) { return false; }

            enterModification();

            while (node.links.length) {
                var link = node.links[0];
                this.removeLink(link);
            }

            delete nodes[nodeId];
            nodesCount--;

            recordNodeChange(node, 'remove');

            exitModification(this);

            return true;
        },

        /**
         * Gets node with given identifier. If node does not exist undefined value is returned.
         *
         * @param nodeId requested node identifier;
         *
         * @return {node} in with requested identifier or undefined if no such node exists.
         */
        getNode : function (nodeId) {
            return nodes[nodeId];
        },

        /**
         * Gets number of nodes in this graph.
         *
         * @return number of nodes in the graph.
         */
        getNodesCount : function () {
            return nodesCount;
        },

        /**
         * Gets total number of links in the graph.
         */
        getLinksCount : function () {
            return links.length;
        },

        /**
         * Gets all links (inbound and outbound) from the node with given id.
         * If node with given id is not found null is returned.
         *
         * @param nodeId requested node identifier.
         *
         * @return Array of links from and to requested node if such node exists;
         *   otherwise null is returned.
         */
        getLinks : function (nodeId) {
            var node = this.getNode(nodeId);
            return node ? node.links : null;
        },

        /**
         * Invokes callback on each node of the graph.
         *
         * @param {Function(node)} callback Function to be invoked. The function
         *   is passed one argument: visited node.
         */
        forEachNode : function (callback) {
            if (typeof callback !== 'function') {
                return;
            }
            var node;

            for (node in nodes) {
                if (nodes.hasOwnProperty(node)) {
                    if (callback(nodes[node])) {
                        return; // client doesn't want to proceed. return.
                    }
                }
            }
        },

        /**
         * Invokes callback on every linked (adjacent) node to the given one.
         *
         * @param nodeId Identifier of the requested node.
         * @param {Function(node, link)} callback Function to be called on all linked nodes.
         *   The function is passed two parameters: adjacent node and link object itself.
         * @param oriented if true graph treated as oriented.
         */
        forEachLinkedNode : function (nodeId, callback, oriented) {
            var node = this.getNode(nodeId),
                i,
                link,
                linkedNodeId;

            if (node && node.links && typeof callback === 'function') {
                // Extraced orientation check out of the loop to increase performance
                if (oriented) {
                    for (i = 0; i < node.links.length; ++i) {
                        link = node.links[i];
                        if (link.fromId === nodeId) {
                            callback(nodes[link.toId], link);
                        }
                    }
                } else {
                    for (i = 0; i < node.links.length; ++i) {
                        link = node.links[i];
                        linkedNodeId = link.fromId === nodeId ? link.toId : link.fromId;

                        callback(nodes[linkedNodeId], link);
                    }
                }
            }
        },

        /**
         * Enumerates all links in the graph
         *
         * @param {Function(link)} callback Function to be called on all links in the graph.
         *   The function is passed one parameter: graph's link object.
         *
         * Link object contains at least the following fields:
         *  fromId - node id where link starts;
         *  toId - node id where link ends,
         *  data - additional data passed to graph.addLink() method.
         */
        forEachLink : function (callback) {
            var i, length;
            if (typeof callback === 'function') {
                for (i = 0, length = links.length; i < length; ++i) {
                    callback(links[i]);
                }
            }
        },

        /**
         * Suspend all notifications about graph changes until
         * endUpdate is called.
         */
        beginUpdate : function () {
            enterModification();
        },

        /**
         * Resumes all notifications about graph changes and fires
         * graph 'changed' event in case there are any pending changes.
         */
        endUpdate : function () {
            exitModification(this);
        },

        /**
         * Removes all nodes and links from the graph.
         */
        clear : function () {
            var that = this;
            that.beginUpdate();
            that.forEachNode(function (node) { that.removeNode(node.id); });
            that.endUpdate();
        },

        /**
         * Detects whether there is a link between two nodes.
         * Operation complexity is O(n) where n - number of links of a node.
         *
         * @returns link if there is one. null otherwise.
         */
        hasLink : function (fromNodeId, toNodeId) {
            // TODO: Use adjacency matrix to speed up this operation.
            var node = this.getNode(fromNodeId),
                i;
            if (!node) {
                return null;
            }

            for (i = 0; i < node.links.length; ++i) {
                var link = node.links[i];
                if (link.fromId === fromNodeId && link.toId === toNodeId) {
                    return link;
                }
            }

            return null; // no link.
        }
    };

    // Let graph fire events before we return it to the caller.
    var eventify = require('ngraph.events');
    eventify(graphPart);

    return graphPart;
};

// need this for old browsers. Should this be a separate module?
function indexOfElementInArray(element, array) {
    if (array.indexOf) {
        return array.indexOf(element);
    }

    var len = array.length,
        i;

    for (i = 0; i < len; i += 1) {
        if (array[i] === element) {
            return i;
        }
    }

    return -1;
}

/**
 * Internal structure to represent node;
 */
function Node(id) {
    this.id = id;
    this.links = [];
    this.data = null;
}


/**
 * Internal structure to represent links;
 */
function Link(fromId, toId, data, id) {
    this.fromId = fromId;
    this.toId = toId;
    this.data = data;
    this.id = id;
}

},{"ngraph.events":4}],4:[function(require,module,exports){
module.exports = function(subject) {
  validateSubject(subject);

  var eventsStorage = createEventsStorage(subject);
  subject.on = eventsStorage.on;
  subject.off = eventsStorage.off;
  subject.fire = eventsStorage.fire;
  return subject;
};

function createEventsStorage(subject) {
  // Store all event listeners to this hash. Key is event name, value is array
  // of callback records.
  //
  // A callback record consists of callback function and its optional context:
  // { 'eventName' => [{callback: function, ctx: object}] }
  var registeredEvents = {};

  return {
    on: function (eventName, callback, ctx) {
      if (typeof callback !== 'function') {
        throw new Error('callback is expected to be a function');
      }
      if (!registeredEvents.hasOwnProperty(eventName)) {
        registeredEvents[eventName] = [];
      }
      registeredEvents[eventName].push({callback: callback, ctx: ctx});

      return subject;
    },

    off: function (eventName, callback) {
      var wantToRemoveAll = (typeof eventName === 'undefined');
      if (wantToRemoveAll) {
        // Killing old events storage should be enough in this case:
        registeredEvents = {};
        return subject;
      }

      if (registeredEvents.hasOwnProperty(eventName)) {
        var deleteAllCallbacksForEvent = (typeof callback !== 'function');
        if (deleteAllCallbacksForEvent) {
          delete registeredEvents[eventName];
        } else {
          var callbacks = registeredEvents[eventName];
          for (var i = 0; i < callbacks.length; ++i) {
            if (callbacks[i].callback === callback) {
              callbacks.splice(i, 1);
            }
          }
        }
      }

      return subject;
    },

    fire: function (eventName) {
      var noEventsToFire = !registeredEvents.hasOwnProperty(eventName);
      if (noEventsToFire) {
        return subject; 
      }

      var callbacks = registeredEvents[eventName];
      var fireArguments = Array.prototype.splice.call(arguments, 1);
      for(var i = 0; i < callbacks.length; ++i) {
        var callbackInfo = callbacks[i];
        callbackInfo.callback.apply(callbackInfo.ctx, fireArguments);
      }

      return subject;
    }
  };
}

function validateSubject(subject) {
  if (!subject) {
    throw new Error('Eventify cannot use falsy object as events subject');
  }
  var reservedWords = ['on', 'fire', 'off'];
  for (var i = 0; i < reservedWords.length; ++i) {
    if (subject.hasOwnProperty(reservedWords[i])) {
      throw new Error("Subject cannot be eventified, since it already has property '" + reservedWords[i] + "'");
    }
  }
}

},{}],5:[function(require,module,exports){
module.exports = createLayout;

// Maximum movement of the system at which system should be considered as stabile
var MAX_MOVEMENT = 0.001; 

var merge = require('./lib/merge');

/**
 * Creates force based layout for a given graph.
 * @param {ngraph.graph} graph which needs to be layed out
 */
function createLayout(graph, settings) {
  if (!graph) {
    throw new Error('Graph structure cannot be undefined');
  }

  settings = merge(settings, {
      /**
       * Ideal length for links (springs in physical model).
       */
      springLength: 80,

      /**
       * Hook's law coefficient. 1 - solid spring.
       */
      springCoeff: 0.0002,

      /**
       * Coulomb's law coefficient. It's used to repel nodes thus should be negative
       * if you make it positive nodes start attract each other :).
       */
      gravity: -1.2,

      /**
       * Theta coeffiecient from Barnes Hut simulation. Ranged between (0, 1).
       * The closer it's to 1 the more nodes algorithm will have to go through.
       * Setting it to one makes Barnes Hut simulation no different from
       * brute-force forces calculation (each node is considered).
       */
      theta: 0.8,

      /**
       * Drag force coefficient. Used to slow down system, thus should be less than 1.
       * The closer it is to 0 the less tight system will be.
       */
      dragCoeff: 0.02,

      /**
       * Default time step (dt) for forces integration
       */
      timeStep : 20,

      /**
       * Calculates mass of a body, which corresponds to node with given id.
       *
       * @param {String|Number} nodeId identifier of a node, for which body mass needs to be calculated
       * @returns {Number} recommended mass of the body;
       */
      nodeMass: function (nodeId) {
        return 1 + graph.getLinks(nodeId).length / 3.0;
      }
  });

  var random = require('ngraph.random').random(42),
      simulator = require('ngraph.physics.simulator'),
      physics = require('ngraph.physics.primitives');

  var nodeBodies = {},
      springs = {},
      physicsSimulator = simulator(),
      graphRect = { x1: 0, y1: 0, x2: 0, y2: 0 };

  // Initialize physical objects according to what we have in the graph:
  initPhysics();
  listenToGraphEvents();

  return {
    /**
     * Performs one step of iterative layout algorithm
     */
    step: function() {
      var totalMovement = physicsSimulator.step(settings.timeStep);
      updateGraphRect();

      return totalMovement < MAX_MOVEMENT;
    },

    /**
     * For a given `nodeId` returns position
     */
    getNodePosition: function (nodeId) {
      return getInitializedBody(nodeId).pos;
    },

    /**
     * @returns {Object} area required to fit in the graph. Object contains
     * `x1`, `y1` - top left coordinates
     * `x2`, `y2` - bottom right coordinates
     */
    getGraphRect: function () {
      return graphRect;
    },

    /*
     * Requests layout algorithm to pin/unpin node to its current position
     * Pinned nodes should not be affected by layout algorithm and always
     * remain at their position
     */
    pinNode: function (node, isPinned) {
      var body = getInitializedBody(node.id);
       body.isPinned = !!isPinned;
    },

    /**
     * Checks whether given graph's node is currently pinned
     */
    isNodePinned: function (node) {
      return getInitializedBody(node.id).isPinned;
    },

    /**
     * Request to release all resources
     */
    dispose: function() {
      graph.off('changed', onGraphChanged);
    }
  };

  function listenToGraphEvents() {
    graph.on('changed', onGraphChanged);
  }

  function onGraphChanged(changes) {
    for (var i = 0; i < changes.length; ++i) {
      var change = changes[i];
      if (change.changeType === 'add') {
        if (change.node) {
          initBody(change.node.id);
        }
        if (change.link) {
          initLink(change.link);
        }
      } else if (change.changeType === 'remove') {
        if (change.node) {
          releaseNode(change.node);
        }
        if (change.link) {
          releaseLink(change.link);
        }
      }
    }
  }

  function initPhysics() {
    graph.forEachNode(function (node) {
      initBody(node.id);
    });
    graph.forEachLink(initLink);
  }

  function initBody(nodeId) {
    var body = nodeBodies[nodeId];
    if (!body) {
      var node = graph.getNode(nodeId);
      if (!node) {
        throw new Error('initBody() was called with unknown node id');
      }

      var pos = getBestInitialNodePosition(node);
      body = new physics.Body(pos.x, pos.y);
      // we need to augment body with previous position to let users pin them
      body.prevPos = new physics.Vector2d(pos.x, pos.y);

      nodeBodies[nodeId] = body;
      updateBodyMass(nodeId);

      if (isNodeOriginallyPinned(node)) {
        body.isPinned = true;
      }

      physicsSimulator.addBody(body);
    }
  }

  function releaseNode(node) {
    var nodeId = node.id;
    var body = nodeBodies[nodeId];
    if (body) {
      nodeBodies[nodeId] = null;
      delete nodeBodies[nodeId];

      physicsSimulator.removeBody(body);
      if (graph.getNodesCount() === 0) {
        graphRect.x1 = graphRect.y1 = 0;
        graphRect.x2 = graphRect.y2 = 0;
      }
    }
  }

  function initLink(link) {
    updateBodyMass(link.fromId);
    updateBodyMass(link.toId);

    var fromBody = nodeBodies[link.fromId],
        toBody  = nodeBodies[link.toId],
        spring = physicsSimulator.addSpring(fromBody, toBody, link.length);

    springs[link.id] = spring;
  }

  function releaseLink(link) {
    var spring = springs[link.id];
    if (spring) {
      var from = graph.getNode(link.fromId),
          to = graph.getNode(link.toId);

      if (from) updateBodyMass(from.id);
      if (to) updateBodyMass(to.id);

      delete springs[link.id];

      physicsSimulator.removeSpring(spring);
    }
  }

  function getBestInitialNodePosition(node) {
    // TODO: Initial position could be picked better, e.g. take into
    // account all neighbouring nodes/links, not only one.
    // How about center of mass?
    if (node.position) {
      return node.position;
    }

    var baseX = (graphRect.x1 + graphRect.x2) / 2,
        baseY = (graphRect.y1 + graphRect.y2) / 2,
        springLength = settings.springLength;

    if (node.links && node.links.length > 0) {
      var firstLink = node.links[0],
          otherBody = firstLink.fromId !== node.id ? nodeBodies[firstLink.fromId] : nodeBodies[firstLink.toId];
      if (otherBody && otherBody.pos) {
        baseX = otherBody.pos.x;
        baseY = otherBody.pos.y;
      }
    }

    return {
      x: baseX + random.next(springLength) - springLength / 2,
      y: baseY + random.next(springLength) - springLength / 2
    };
  }

  function updateBodyMass(nodeId) {
    var body = nodeBodies[nodeId];
    body.mass = settings.nodeMass(nodeId);
  }


  function updateGraphRect() {
    if (graph.getNodesCount() === 0) {
      // don't have to wory here.
      return;
    }

    var x1 = Number.MAX_VALUE,
        y1 = Number.MAX_VALUE,
        x2 = Number.MIN_VALUE,
        y2 = Number.MIN_VALUE;

    // this is O(n), could it be done faster with quadtree?
    for (var key in nodeBodies) {
      if (nodeBodies.hasOwnProperty(key)) {
        // how about pinned nodes?
        var body = nodeBodies[key];
        if (isBodyPinned(body)) {
          body.pos.x = body.prevPos.x;
          body.pos.y = body.prevPos.y;
        } else {
          body.prevPos.x = body.pos.x;
          body.prevPos.y = body.pos.y;
        }
        if (body.pos.x < x1) {
          x1 = body.pos.x;
        }
        if (body.pos.x > x2) {
          x2 = body.pos.x;
        }
        if (body.pos.y < y1) {
          y1 = body.pos.y;
        }
        if (body.pos.y > y2) {
          y2 = body.pos.y;
        }
      }
    }

    graphRect.x1 = x1;
    graphRect.x2 = x2;
    graphRect.y1 = y1;
    graphRect.y2 = y2;
  }

  /**
   * Checks whether graph node has in its settings pinned attribute,
   * which means layout algorithm cannot move it. Node can be preconfigured
   * as pinned, if it has "isPinned" attribute, or when node.data has it.
   *
   * @param {Object} node a graph node to check
   * @return {Boolean} true if node should be treated as pinned; false otherwise.
   */
  function isNodeOriginallyPinned(node) {
    return (node && (node.isPinned || (node.data && node.data.isPinned)));
  }

  /**
   * Checks whether given physical body should be treated as pinned. Unlinke
   * `isNodeOriginallyPinned` this operates on body object, which is specific to layout
   * instance. Thus two layouters can independntly pin bodies, which represent
   * same node of a source graph.
   *
   * @param {ngraph.physics.Body} body - body to check
   * @return {Boolean} true if body should be treated as pinned; false otherwise.
   */
  function isBodyPinned (body) {
    return body.isPinned;
  }

  function getInitializedBody(nodeId) {
    var body = nodeBodies[nodeId];
    if (!body) {
      initBody(nodeId);
      body = nodeBodies[nodeId];
    }
    return body;
  }
}

},{"./lib/merge":6,"ngraph.physics.primitives":7,"ngraph.physics.simulator":8,"ngraph.random":19}],6:[function(require,module,exports){
module.exports = merge;

// TODO: this should be in its own module
function merge(target, options) {
  var key;
  if (!target) { target = {}; }
  if (options) {
    for (key in options) {
      if (options.hasOwnProperty(key)) {
        var targetHasIt = target.hasOwnProperty(key),
            optionsValueType = typeof options[key],
            shouldReplace = !targetHasIt || (typeof target[key] !== optionsValueType);

        if (shouldReplace) {
          target[key] = options[key];
        } else if (optionsValueType === 'object') {
          // go deep, don't care about loops here, we are simple API!:
          target[key] = merge(target[key], options[key]);
        }
      }
    }
  }

  return target;
}

},{}],7:[function(require,module,exports){
module.exports = {
  Body: Body,
  Vector2d: Vector2d
  // that's it for now
};

function Body(x, y) {
  this.pos = new Vector2d(x, y);
  this.force = new Vector2d();
  this.velocity = new Vector2d();
  this.mass = 1;
}

function Vector2d(x, y) {
  this.x = typeof x === 'number' ? x : 0;
  this.y = typeof y === 'number' ? y : 0;
}

},{}],8:[function(require,module,exports){
/**
 * Manages a simulation of physical forces acting on bodies and springs.
 */
module.exports = physicsSimulator;

function physicsSimulator() {
  var Spring = require('./lib/spring');
  var createQuadTree = require('ngraph.quadtreebh');
  var createDragForce = require('./lib/dragForce');
  var createSpringForce = require('./lib/springForce');
  var integrate = require('./lib/eulerIntegrator');

  var bodies = [], // Bodies in this simulation.
      springs = [], // Springs in this simulation.
      quadTree = createQuadTree(),
      springForce = createSpringForce(),
      dragForce = createDragForce();

  return {
    /**
     * Array of bodies, registered with current simulator
     *
     * Note: To add new body, use addBody() method. This property is only
     * exposed for testing/performance purposes.
     */
    bodies: bodies,

    /**
     * Performs one step of force simulation.
     * @param {Number} timeStep - integration step
     *
     * @returns {Number} Total movement of the system. Calculated as:
     *   (total distance traveled by bodies)^2/(total # of bodies)
     */
    step: function (timeStep) {
      // I'm reluctant to check timeStep here, since this method is going to be
      // super hot, I don't want to add more complexity to it
      accumulateForces();
      return integrate(bodies, timeStep);
    },

    /**
     * Adds body to the system
     *
     * @param {ngraph.physics.primitives.Body} body physical body
     *
     * @returns {ngraph.physics.primitives.Body} added body
     */
    addBody: function (body) {
      if (!body) {
        throw new Error('Body is required');
      }
      bodies.push(body);

      return body;
    },

    /**
     * Removes body from the system
     *
     * @param {ngraph.physics.primitives.Body} body to remove
     *
     * @returns {Boolean} true if body found and removed. falsy otherwise;
     */
    removeBody: function (body) {
      if (!body) { return; }
      var idx = bodies.indexOf(body);
      if (idx > -1) {
        bodies.splice(idx, 1);
        return true;
      }
    },

    /**
     * Adds a spring to this simulation.
     *
     * @returns {Object} - a handle for a spring. If you want to later remove
     * spring pass it to removeSpring() method.
     */
    addSpring: function (body1, body2, springLength, springWeight, springCoefficient) {
      if (!body1 || !body2) {
        throw new Error('Cannot add null spring to force simulator');
      }

      if (typeof springLength !== 'number') {
        springLength = -1; // assume global configuration
      }

      var spring = new Spring(body1, body2, springLength, springCoefficient >= 0 ? springCoefficient : -1, springWeight);
      springs.push(spring);

      // TODO: could mark simulator as dirty.
      return spring;
    },

    /**
     * Removes spring from the system
     *
     * @param {Object} spring to remove. Spring is an object returned by addSpring
     *
     * @returns {Boolean} true if spring found and removed. falsy otherwise;
     */
    removeSpring: function (spring) {
      if (!spring) { return; }
      var idx = springs.indexOf(spring);
      if (idx > -1) {
        springs.splice(idx, 1);
        return true;
      }
    }
  };

  function accumulateForces() {
    // Accumulate forces acting on bodies.
    var body,
        i = bodies.length;

    if (i) {
      // only add bodies if there the array is not empty:
      quadTree.insertBodies(bodies); // performance: O(n * log n)
      while (i--) {
        body = bodies[i];
        body.force.x = 0;
        body.force.y = 0;

        quadTree.updateBodyForce(body);
        dragForce.update(body);
      }
    }

    i = springs.length;
    while(i--) {
      springForce.update(springs[i]);
    }
  }
};

},{"./lib/dragForce":9,"./lib/eulerIntegrator":10,"./lib/spring":11,"./lib/springForce":12,"ngraph.quadtreebh":13}],9:[function(require,module,exports){
/**
 * Represents drag force, which reduces force value on each step by given
 * coefficient.
 *
 * @param {Object} options for the drag force
 * @param {Number=} options.coeff drag force coefficient. 0.1 by default
 */
module.exports = function (options) {
  if (!options) {
    options = {};
  }

  var currentOptions = {
    coeff : options.coeff || 0.01
  };

  return {
    update : function (body) {
      body.force.x -= currentOptions.coeff * body.velocity.x;
      body.force.y -= currentOptions.coeff * body.velocity.y;
    },
    options : function (newOptions) {
      if (newOptions) {
        if (typeof newOptions.coeff === 'number') { currentOptions.coeff = newOptions.coeff; }

        return this;
      }

      return currentOptions;
    }
  };
};

},{}],10:[function(require,module,exports){
/**
 * Performs forces integration, using given timestep. Uses Euler method to solve
 * differential equation (http://en.wikipedia.org/wiki/Euler_method ).
 *
 * @returns {Number} squared distance of total position updates.
 */

module.exports = integrate;

function integrate(bodies, timeStep) {
  var dx = 0, tx = 0,
      dy = 0, ty = 0,
      i,
      max = bodies.length;

  for (i = 0; i < max; ++i) {
    var body = bodies[i],
        coeff = timeStep / body.mass;

    body.velocity.x += coeff * body.force.x;
    body.velocity.y += coeff * body.force.y;
    var vx = body.velocity.x,
        vy = body.velocity.y,
        v = Math.sqrt(vx * vx + vy * vy);

    if (v > 1) {
      body.velocity.x = vx / v;
      body.velocity.y = vy / v;
    }

    dx = timeStep * body.velocity.x;
    dy = timeStep * body.velocity.y;

    body.pos.x += dx;
    body.pos.y += dy;

    // TODO: this is not accurate. Total value should be absolute
    tx += dx; ty += dy;
  }

  return (tx * tx + ty * ty)/bodies.length;
}

},{}],11:[function(require,module,exports){
module.exports = Spring;

/**
 * Represents a physical spring. Spring connects two bodies, has rest length
 * stiffness coefficient and optional weight
 */
function Spring(body1, body2, length, coeff, weight) {
    this.body1 = body1;
    this.body2 = body2;
    this.length = length;
    this.coeff = coeff;

    this.weight = typeof weight === 'number' ? weight : 1;
};

},{}],12:[function(require,module,exports){
/**
 * Represents spring force, which updates forces acting on two bodies, conntected
 * by a spring.
 *
 * @param {Object} options for the spring force
 * @param {Number=} options.coeff spring force coefficient.
 * @param {Number=} options.lenght desired length of a spring at rest.
 */
module.exports = function (options) {
  if (!options) {
    options = {};
  }

  var random = require('ngraph.random').random(42);
  var currentOptions = {
    coeff : options.coeff || 0.00022,
    length: options.length || 50
  };

  return {
    /**
     * Upsates forces acting on a spring
     */
    update : function (spring) {
      var body1 = spring.body1,
          body2 = spring.body2,
          length = spring.length < 0 ? currentOptions.length : spring.length,
          dx = body2.pos.x - body1.pos.x,
          dy = body2.pos.y - body1.pos.y,
          r = Math.sqrt(dx * dx + dy * dy);

      if (r === 0) {
          dx = (random.nextDouble() - 0.5) / 50;
          dy = (random.nextDouble() - 0.5) / 50;
          r = Math.sqrt(dx * dx + dy * dy);
      }

      var d = r - length;
      var coeff = ((!spring.coeff || spring.coeff < 0) ? currentOptions.coeff : spring.coeff) * d / r * spring.weight;

      body1.force.x += coeff * dx;
      body1.force.y += coeff * dy;

      body2.force.x -= coeff * dx;
      body2.force.y -= coeff * dy;
    },

    options : function (newOptions) {
      if (newOptions) {
        if (typeof newOptions.length === 'number') { currentOptions.length = newOptions.length; }
        if (typeof newOptions.coeff === 'number') { currentOptions.coeff = newOptions.coeff; }

        return this;
      }
      return currentOptions;
    }
  };
}

},{"ngraph.random":18}],13:[function(require,module,exports){
/**
 * This is Barnes Hut simulation algorithm. Implementation
 * is adopted to non-recursive solution, since certain browsers
 * handle recursion extremly bad.
 *
 * http://www.cs.princeton.edu/courses/archive/fall03/cs126/assignments/barnes-hut.html
 */

module.exports = function (options) {
    options = options || {};
    options.gravity = typeof options.gravity === 'number' ? options.gravity : -1;
    options.theta = typeof options.theta === 'number' ? options.theta : 0.8;

    // we require deterministic randomness here
    var random = require('ngraph.random').random(1984),
        Node = require('./node'),
        InsertStack = require('./insertStack'),
        isSamePosition = require('./isSamePosition');

    var gravity = options.gravity,
        updateQueue = [],
        insertStack = new InsertStack(),
        theta = options.theta,

        nodesCache = [],
        currentInCache = 0,
        newNode = function () {
            // To avoid pressure on GC we reuse nodes.
            var node = nodesCache[currentInCache];
            if (node) {
                node.quads[0] = null;
                node.quads[1] = null;
                node.quads[2] = null;
                node.quads[3] = null;
                node.body = null;
                node.mass = node.massX = node.massY = 0;
                node.left = node.right = node.top = node.bottom = 0;
            } else {
                node = new Node();
                nodesCache[currentInCache] = node;
            }

            ++currentInCache;
            return node;
        },

        root = newNode(),

        // Inserts body to the tree
        insert = function (newBody) {
            insertStack.reset();
            insertStack.push(root, newBody);

            while (!insertStack.isEmpty()) {
                var stackItem = insertStack.pop(),
                    node = stackItem.node,
                    body = stackItem.body;

                if (!node.body) {
                    // This is internal node. Update the total mass of the node and center-of-mass.
                    var x = body.pos.x;
                    var y = body.pos.y;
                    node.mass = node.mass + body.mass;
                    node.massX = node.massX + body.mass * x;
                    node.massY = node.massY + body.mass * y;

                    // Recursively insert the body in the appropriate quadrant.
                    // But first find the appropriate quadrant.
                    var quadIdx = 0, // Assume we are in the 0's quad.
                        left = node.left,
                        right = (node.right + left) / 2,
                        top = node.top,
                        bottom = (node.bottom + top) / 2;

                    if (x > right) { // somewhere in the eastern part.
                        quadIdx = quadIdx + 1;
                        var oldLeft = left;
                        left = right;
                        right = right + (right - oldLeft);
                    }
                    if (y > bottom) { // and in south.
                        quadIdx = quadIdx + 2;
                        var oldTop = top;
                        top = bottom;
                        bottom = bottom + (bottom - oldTop);
                    }

                    var child = node.quads[quadIdx];
                    if (!child) {
                        // The node is internal but this quadrant is not taken. Add
                        // subnode to it.
                        child = newNode();
                        child.left = left;
                        child.top = top;
                        child.right = right;
                        child.bottom = bottom;
                        child.body = body;

                        node.quads[quadIdx] = child;
                    } else {
                        // continue searching in this quadrant.
                        insertStack.push(child, body);
                    }
                } else {
                    // We are trying to add to the leaf node.
                    // We have to convert current leaf into internal node
                    // and continue adding two nodes.
                    var oldBody = node.body;
                    node.body = null; // internal nodes do not cary bodies

                    if (isSamePosition(oldBody.pos, body.pos)) {
                        // Prevent infinite subdivision by bumping one node
                        // anywhere in this quadrant
                        if (node.right - node.left < 1e-8) {
                            // This is very bad, we ran out of precision.
                            // if we do not return from the method we'll get into
                            // infinite loop here. So we sacrifice correctness of layout, and keep the app running
                            // Next layout iteration should get larger bounding box in the first step and fix this
                            return;
                        }
                        do {
                            var offset = random.nextDouble();
                            var dx = (node.right - node.left) * offset;
                            var dy = (node.bottom - node.top) * offset;

                            oldBody.pos.x = node.left + dx;
                            oldBody.pos.y = node.top + dy;
                            // Make sure we don't bump it out of the box. If we do, next iteration should fix it
                        } while (isSamePosition(oldBody.pos, body.pos));

                    }
                    // Next iteration should subdivide node further.
                    insertStack.push(node, oldBody);
                    insertStack.push(node, body);
                }
           }
        },

        update = function (sourceBody) {
            var queue = updateQueue,
                v,
                dx,
                dy,
                r,
                queueLength = 1,
                shiftIdx = 0,
                pushIdx = 1;

            queue[0] = root;

            while (queueLength) {
                var node = queue[shiftIdx],
                    body = node.body;

                queueLength -= 1;
                shiftIdx += 1;
                // technically there should be external "if (body !== sourceBody) {"
                // but in practice it gives slightghly worse performance, and does not
                // have impact on layout correctness
                if (body && body !== sourceBody) {
                    // If the current node is a leaf node (and it is not source body),
                    // calculate the force exerted by the current node on body, and add this
                    // amount to body's net force.
                    dx = body.pos.x - sourceBody.pos.x;
                    dy = body.pos.y - sourceBody.pos.y;
                    r = Math.sqrt(dx * dx + dy * dy);

                    if (r === 0) {
                        // Poor man's protection against zero distance.
                        dx = (random.nextDouble() - 0.5) / 50;
                        dy = (random.nextDouble() - 0.5) / 50;
                        r = Math.sqrt(dx * dx + dy * dy);
                    }

                    // This is standard gravition force calculation but we divide
                    // by r^3 to save two operations when normalizing force vector.
                    v = gravity * body.mass * sourceBody.mass / (r * r * r);
                    sourceBody.force.x += v * dx;
                    sourceBody.force.y += v * dy;
                } else {
                    // Otherwise, calculate the ratio s / r,  where s is the width of the region
                    // represented by the internal node, and r is the distance between the body
                    // and the node's center-of-mass
                    dx = node.massX / node.mass - sourceBody.pos.x;
                    dy = node.massY / node.mass - sourceBody.pos.y;
                    r = Math.sqrt(dx * dx + dy * dy);

                    if (r === 0) {
                        // Sorry about code duplucation. I don't want to create many functions
                        // right away. Just want to see performance first.
                        dx = (random.nextDouble() - 0.5) / 50;
                        dy = (random.nextDouble() - 0.5) / 50;
                        r = Math.sqrt(dx * dx + dy * dy);
                    }
                    // If s / r < θ, treat this internal node as a single body, and calculate the
                    // force it exerts on body b, and add this amount to b's net force.
                    if ((node.right - node.left) / r < theta) {
                        // in the if statement above we consider node's width only
                        // because the region was squarified during tree creation.
                        // Thus there is no difference between using width or height.
                        v = gravity * node.mass * sourceBody.mass / (r * r * r);
                        sourceBody.force.x += v * dx;
                        sourceBody.force.y += v * dy;
                    } else {
                        // Otherwise, run the procedure recursively on each of the current node's children.

                        // I intentionally unfolded this loop, to save several CPU cycles.
                        if (node.quads[0]) { queue[pushIdx] = node.quads[0]; queueLength += 1; pushIdx += 1; }
                        if (node.quads[1]) { queue[pushIdx] = node.quads[1]; queueLength += 1; pushIdx += 1; }
                        if (node.quads[2]) { queue[pushIdx] = node.quads[2]; queueLength += 1; pushIdx += 1; }
                        if (node.quads[3]) { queue[pushIdx] = node.quads[3]; queueLength += 1; pushIdx += 1; }
                    }
                }
            }
        },

        insertBodies = function (bodies) {
            var x1 = Number.MAX_VALUE,
                y1 = Number.MAX_VALUE,
                x2 = Number.MIN_VALUE,
                y2 = Number.MIN_VALUE,
                i,
                max = bodies.length;

            // To reduce quad tree depth we are looking for exact bounding box of all particles.
            i = max;
            while (i--) {
                var x = bodies[i].pos.x;
                var y = bodies[i].pos.y;
                if (x < x1) { x1 = x; }
                if (x > x2) { x2 = x; }
                if (y < y1) { y1 = y; }
                if (y > y2) { y2 = y; }
            }

            // Squarify the bounds.
            var dx = x2 - x1,
                dy = y2 - y1;
            if (dx > dy) { y2 = y1 + dx; } else { x2 = x1 + dy; }

            currentInCache = 0;
            root = newNode();
            root.left = x1;
            root.right = x2;
            root.top = y1;
            root.bottom = y2;

            i = max - 1;
            if (i > 0) {
              root.body = bodies[i];
            }
            while (i--) {
                insert(bodies[i], root);
            }
        };

    return {
        insertBodies : insertBodies,
        updateBodyForce : update,
        options : function (newOptions) {
            if (newOptions) {
                if (typeof newOptions.gravity === 'number') { gravity = newOptions.gravity; }
                if (typeof newOptions.theta === 'number') { theta = newOptions.theta; }

                return this;
            }

            return {gravity : gravity, theta : theta};
        }
    };
};


},{"./insertStack":14,"./isSamePosition":15,"./node":16,"ngraph.random":17}],14:[function(require,module,exports){
module.exports = InsertStack;

/**
 * Our implmentation of QuadTree is non-recursive (recursion handled not really
 * well in old browsers). This data structure represent stack of elemnts
 * which we are trying to insert into quad tree. It also avoids unnecessary
 * memory pressue when we are adding more elements
 */
function InsertStack () {
    this.stack = [];
    this.popIdx = 0;
}

InsertStack.prototype = {
    isEmpty: function() {
        return this.popIdx === 0;
    },
    push: function (node, body) {
        var item = this.stack[this.popIdx];
        if (!item) {
            // we are trying to avoid memory pressue: create new element
            // only when absolutely necessary
            this.stack[this.popIdx] = new InsertStackElement(node, body);
        } else {
            item.node = node;
            item.body = body;
        }
        ++this.popIdx;
    },
    pop: function () {
        if (this.popIdx > 0) {
            return this.stack[--this.popIdx];
        }
    },
    reset: function () {
        this.popIdx = 0;
    }
};

function InsertStackElement(node, body) {
    this.node = node; // QuadTree node
    this.body = body; // physical body which needs to be inserted to node
}

},{}],15:[function(require,module,exports){
module.exports = function isSamePosition(point1, point2) {
    var dx = Math.abs(point1.x - point2.x);
    var dy = Math.abs(point1.y - point2.y);

    return (dx < 1e-8 && dy < 1e-8);
};

},{}],16:[function(require,module,exports){
/**
 * Internal data structure to represent 2D QuadTree node
 */
module.exports = function Node() {
  // body stored inside this node. In quad tree only leaf nodes (by construction)
  // contain boides:
  this.body = null;

  // Child nodes are stored in quads. Each quad is presented by number:
  // 0 | 1
  // -----
  // 2 | 3
  this.quads = [];

  // Total mass of current node
  this.mass = 0;

  // Center of mass coordinates
  this.massX = 0;
  this.massY = 0;

  // bounding box coordinates
  this.left = 0;
  this.top = 0;
  this.bottom = 0;
  this.right = 0;

  // Node is internal when it is not a leaf
  this.isInternal = false;
};

},{}],17:[function(require,module,exports){
module.exports = {
  random: random,
  randomIterator: randomIterator
};

/**
 * Creates seeded PRNG with two methods:
 *   next() and nextDouble()
 */
function random(inputSeed) {
  var seed = typeof inputSeed === 'number' ? inputSeed : (+ new Date());
  var randomFunc = function() {
      // Robert Jenkins' 32 bit integer hash function.
      seed = ((seed + 0x7ed55d16) + (seed << 12))  & 0xffffffff;
      seed = ((seed ^ 0xc761c23c) ^ (seed >>> 19)) & 0xffffffff;
      seed = ((seed + 0x165667b1) + (seed << 5))   & 0xffffffff;
      seed = ((seed + 0xd3a2646c) ^ (seed << 9))   & 0xffffffff;
      seed = ((seed + 0xfd7046c5) + (seed << 3))   & 0xffffffff;
      seed = ((seed ^ 0xb55a4f09) ^ (seed >>> 16)) & 0xffffffff;
      return (seed & 0xfffffff) / 0x10000000;
  };

  return {
      /**
       * Generates random integer number in the range from 0 (inclusive) to maxValue (exclusive)
       *
       * @param maxValue Number REQUIRED. Ommitting this number will result in NaN values from PRNG.
       */
      next : function (maxValue) {
          return Math.floor(randomFunc() * maxValue);
      },

      /**
       * Generates random double number in the range from 0 (inclusive) to 1 (exclusive)
       * This function is the same as Math.random() (except that it could be seeded)
       */
      nextDouble : function () {
          return randomFunc();
      }
  };
}

/*
 * Creates iterator over array, which returns items of array in random order
 * Time complexity is guaranteed to be O(n);
 */
function randomIterator(array, customRandom) {
    var localRandom = customRandom || random();
    if (typeof localRandom.next !== 'function') {
      throw new Error('customRandom does not match expected API: next() function is missing');
    }

    return {
        forEach : function (callback) {
            var i, j, t;
            for (i = array.length - 1; i > 0; --i) {
                j = localRandom.next(i + 1); // i inclusive
                t = array[j];
                array[j] = array[i];
                array[i] = t;

                callback(t);
            }

            if (array.length) {
                callback(array[0]);
            }
        },

        /**
         * Shuffles array randomly, in place.
         */
        shuffle : function () {
            var i, j, t;
            for (i = array.length - 1; i > 0; --i) {
                j = localRandom.next(i + 1); // i inclusive
                t = array[j];
                array[j] = array[i];
                array[i] = t;
            }

            return array;
        }
    };
}

},{}],18:[function(require,module,exports){
module.exports=require(17)
},{}],19:[function(require,module,exports){
module.exports=require(17)
},{}]},{},[1])
(1)
});
;