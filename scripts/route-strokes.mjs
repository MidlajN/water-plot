/**
 * Stroke routing for joined script fonts.
 *
 * A pen plotter lifts the pen (a Z move) between every pair of subpaths whose
 * ends do not meet. Hershey Script draws many lowercase letters in several
 * strokes, and starts round letters ("a", "c", "o"...) at the top of the bowl
 * instead of at the point where the previous letter's exit stroke arrives. So
 * even though the letters touch, a word is plotted as many separate pen-downs.
 *
 * `routeGlyph` re-orders a glyph's polylines so that every group of touching
 * strokes is drawn in one continuous run:
 * - the strokes become a graph (a stroke ending on another stroke's middle
 *   splits it there);
 * - the run for the group holding the entry point starts exactly at the entry
 *   point and ends exactly at the exit point, so consecutive letters chain
 *   into one pen-down;
 * - where a single run is impossible without retracing (dead-end stems, the
 *   top of "t", the bowl of "a"), the shortest set of segments is drawn twice
 *   (an open Chinese-postman route), like a hand going back up a stem;
 * - at junctions the run continues in the straightest direction.
 * Strokes that touch nothing (the dots of "i"/"j", the bar of "t", the second
 * stroke of "x") stay separate and come after the main run, so the plotter
 * draws them after the joined word, as a hand would.
 */

const VERTEX_SNAP = 1;
/** How far a stroke end may sit from another stroke's segment and still join it. */
const SEGMENT_SNAP = 1.5;

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function project(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length : 0;
  const clamped = Math.max(0, Math.min(1, t));
  const q = [a[0] + clamped * dx, a[1] + clamped * dy];
  return { t, q, d: distance(p, q) };
}

class StrokeGraph {
  constructor() {
    this.points = [];
    /** Edges: { a, b, used } with vertex indices; parallel edges are allowed. */
    this.edges = [];
  }

  vertex(point, snap = VERTEX_SNAP) {
    const found = this.points.findIndex((existing) => distance(existing, point) <= snap);
    if (found >= 0) return found;
    this.points.push([...point]);
    return this.points.length - 1;
  }

  addEdge(a, b) {
    if (a !== b) this.edges.push({ a, b, used: false });
  }

  degree(v) {
    return this.edges.reduce((sum, edge) => sum + (edge.a === v) + (edge.b === v), 0);
  }

  length(edge) {
    return distance(this.points[edge.a], this.points[edge.b]);
  }

  /**
   * Splits the nearest edge whose interior passes within `snap` of `point`.
   * With `reuse`, that existing vertex becomes the split point (a stroke end
   * landing on another stroke); otherwise a new vertex is placed on the edge.
   * Returns the vertex, or -1 when no edge is close enough.
   */
  splitAt(point, snap = SEGMENT_SNAP, reuse = -1) {
    let best = null;
    this.edges.forEach((edge, index) => {
      if (edge.a === reuse || edge.b === reuse) return;
      const { t, q, d } = project(point, this.points[edge.a], this.points[edge.b]);
      if (t <= 0 || t >= 1 || d > snap || (best && d >= best.d)) return;
      best = { index, edge, q, d };
    });
    if (!best) return -1;

    const { index, edge, q } = best;
    if (distance(q, this.points[edge.a]) <= VERTEX_SNAP) return edge.a;
    if (distance(q, this.points[edge.b]) <= VERTEX_SNAP) return edge.b;

    let v = reuse;
    if (v < 0) {
      this.points.push(best.d <= VERTEX_SNAP ? [...point] : q);
      v = this.points.length - 1;
    }
    this.edges.splice(index, 1, { a: edge.a, b: v, used: false }, { a: v, b: edge.b, used: false });
    return v;
  }

  /**
   * Vertex exactly at `point`: an existing vertex, a split segment, or a short
   * connector to the nearest segment within `snap`. -1 if the strokes are farther.
   */
  attach(point, snap) {
    const near = this.points.findIndex((existing) => distance(existing, point) <= Math.min(snap, 2));
    if (near >= 0) {
      this.points[near] = [...point];
      return near;
    }
    const v = this.splitAt(point, snap);
    if (v < 0) return -1;
    if (distance(this.points[v], point) <= VERTEX_SNAP) {
      this.points[v] = [...point];
      return v;
    }
    this.points.push([...point]);
    this.addEdge(this.points.length - 1, v);
    return this.points.length - 1;
  }

  components() {
    const parent = this.points.map((_, i) => i);
    const find = (v) => (parent[v] === v ? v : (parent[v] = find(parent[v])));
    for (const edge of this.edges) parent[find(edge.a)] = find(edge.b);

    const groups = new Map();
    for (const edge of this.edges) {
      const root = find(edge.a);
      if (!groups.has(root)) groups.set(root, new Set());
      groups.get(root).add(edge.a).add(edge.b);
    }
    return [...groups.values()];
  }

  /** Shortest distances and predecessor edges from `source` (Dijkstra over edge lengths). */
  shortestPaths(source) {
    const dist = this.points.map(() => Infinity);
    const via = this.points.map(() => -1);
    const done = new Set();
    dist[source] = 0;
    while (true) {
      let u = -1;
      for (let i = 0; i < dist.length; i++) if (!done.has(i) && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0) break;
      done.add(u);
      this.edges.forEach((edge, index) => {
        if (edge.a !== u && edge.b !== u) return;
        const w = edge.a === u ? edge.b : edge.a;
        const candidate = dist[u] + this.length(edge);
        if (candidate < dist[w]) {
          dist[w] = candidate;
          via[w] = index;
        }
      });
    }
    return { dist, via };
  }
}

const STRETCH_TURN = 50;

const heading = (from, to) => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
const headingDifference = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

/**
 * Moves the nearest suitable free stroke end onto `target` and returns its vertex, or null.
 * The end's last segment is re-aimed at the target; it must stay within STRETCH_TURN of the
 * segment before it, so the stroke keeps its flow instead of kinking.
 */
function stretchTo(graph, lineVertices, target, maxDistance) {
  // Free stroke ends with the two points before them, in the stroke's own order.
  const ends = lineVertices
    .filter((vertices) => vertices.length >= 3)
    .flatMap((vertices) => [vertices.slice(-3).reverse(), vertices.slice(0, 3)]);

  let best = null;
  for (const [p, q, r] of ends) {
    const point = graph.points[p];
    const d = distance(point, target);
    if (d > maxDistance || target[0] < point[0] || graph.degree(p) !== 1) continue;
    const incoming = heading(graph.points[r], graph.points[q]);
    if (headingDifference(incoming, heading(graph.points[q], target)) > STRETCH_TURN) continue;
    if (!best || d < best.d) best = { p, d };
  }
  if (!best) return null;
  graph.points[best.p] = [...target];
  return best.p;
}

/** Minimum-cost perfect matching of a small vertex set (bitmask DP). */
function minMatching(vertices, cost) {
  const n = vertices.length;
  const memo = new Map();
  const solve = (mask) => {
    if (mask === (1 << n) - 1) return { total: 0, pairs: [] };
    if (memo.has(mask)) return memo.get(mask);
    let i = 0;
    while (mask & (1 << i)) i++;
    let best = { total: Infinity, pairs: [] };
    for (let j = i + 1; j < n; j++) {
      if (mask & (1 << j)) continue;
      const rest = solve(mask | (1 << i) | (1 << j));
      const total = rest.total + cost(vertices[i], vertices[j]);
      if (total < best.total) best = { total, pairs: [[vertices[i], vertices[j]], ...rest.pairs] };
    }
    memo.set(mask, best);
    return best;
  };
  return solve(0);
}

/**
 * Plans an open route over one component from `start` to `end` (either may be
 * null = free). Returns { start, end, retrace: [[u, v], ...] } with the least
 * total retraced length.
 */
function planComponent(graph, vertices, start, end, paths) {
  const odd = [...vertices].filter((v) => graph.degree(v) % 2 === 1);
  const cost = (u, v) => paths.get(u).dist[v];

  const evaluate = (s, e) => {
    const toggled = new Set(odd);
    for (const v of [s, e]) {
      if (toggled.has(v)) toggled.delete(v);
      else toggled.add(v);
    }
    const set = [...toggled];
    if (set.length % 2) return null;
    const { total, pairs } = minMatching(set, cost);
    return { start: s, end: e, total, retrace: pairs };
  };

  const startOptions = start !== null ? [start] : odd.length ? odd : [...vertices];
  let best = null;
  for (const s of startOptions) {
    const endOptions = end !== null ? [end] : odd.length ? odd.filter((v) => v !== s) : [s];
    for (const e of endOptions.length ? endOptions : [s]) {
      const plan = evaluate(s, e);
      if (plan && (!best || plan.total < best.total - 1e-9)) best = plan;
    }
  }
  return best;
}

/** Fleury's algorithm, preferring non-bridges, then the straightest continuation. */
function walk(graph, start, incoming) {
  const route = [start];
  let at = start;
  let heading = incoming;

  const reachableEdges = (from) => {
    const seen = new Set([from]);
    const stack = [from];
    let count = 0;
    const counted = new Set();
    while (stack.length) {
      const u = stack.pop();
      graph.edges.forEach((edge, index) => {
        if (edge.used || (edge.a !== u && edge.b !== u)) return;
        if (!counted.has(index)) {
          counted.add(index);
          count++;
        }
        const w = edge.a === u ? edge.b : edge.a;
        if (!seen.has(w)) {
          seen.add(w);
          stack.push(w);
        }
      });
    }
    return count;
  };

  while (true) {
    const options = graph.edges
      .map((edge, index) => ({ edge, index }))
      .filter(({ edge }) => !edge.used && (edge.a === at || edge.b === at));
    if (!options.length) break;

    const total = reachableEdges(at);
    const scored = options.map(({ edge }) => {
      const next = edge.a === at ? edge.b : edge.a;
      edge.used = true;
      const bridge = options.length > 1 && reachableEdges(next) < total - 1;
      edge.used = false;
      const dir = [graph.points[next][0] - graph.points[at][0], graph.points[next][1] - graph.points[at][1]];
      const turn = heading ? Math.abs(Math.atan2(heading[0] * dir[1] - heading[1] * dir[0], heading[0] * dir[0] + heading[1] * dir[1])) : 0;
      return { edge, next, dir, bridge, turn };
    });
    scored.sort((p, q) => p.bridge - q.bridge || p.turn - q.turn);

    const choice = scored[0];
    choice.edge.used = true;
    heading = choice.dir;
    at = choice.next;
    route.push(at);
  }
  return route.map((v) => [...graph.points[v]]);
}

/**
 * Routes a glyph's strokes.
 * @param {number[][][]} polylines  strokes as lists of [x, y]
 * @param {{
 *   entry?: number[] | null, exit?: number[] | null, attachSnap?: number,
 *   stretchExit?: number, entryHeading?: number[]
 * }} options  `stretchExit`: when no stroke reaches the exit, a free stroke end up to this far
 *   away is moved onto it, if its last segment can reach it without turning by more than
 *   STRETCH_TURN (a capital's final flourish stretched to meet the next letter).
 * @returns {{ strokes: number[][][], joinsEntry: boolean, joinsExit: boolean, stretched: boolean, retraced: number }}
 */
export function routeGlyph(polylines, { entry = null, exit = null, attachSnap = 2, stretchExit = 0, entryHeading = [1, 1] } = {}) {
  const graph = new StrokeGraph();
  const strokeEnds = [];
  const lineVertices = [];

  for (const line of polylines) {
    let previous = null;
    const vertices = [];
    for (const point of line) {
      const v = graph.vertex(point);
      if (previous !== null) graph.addEdge(previous, v);
      previous = v;
      vertices.push(v);
    }
    lineVertices.push(vertices);
    strokeEnds.push(vertices[0], vertices.at(-1));
  }

  // A stroke ending on the middle of another stroke joins it there.
  for (const v of strokeEnds) {
    if (graph.degree(v) === 1) graph.splitAt(graph.points[v], SEGMENT_SNAP, v);
  }

  // Entry and exit must be exact so neighbouring letters meet.
  const pin = (point) => {
    if (!point) return null;
    const v = graph.attach(point, attachSnap);
    return v >= 0 ? v : null;
  };
  const entryVertex = pin(entry);
  let exitVertex = pin(exit);
  let stretched = false;
  if (exitVertex === null && exit && stretchExit > 0) {
    exitVertex = stretchTo(graph, lineVertices, exit, stretchExit);
    stretched = exitVertex !== null;
  }

  const paths = new Map(graph.points.map((_, v) => [v, graph.shortestPaths(v)]));
  const components = graph.components();
  const holds = (component, v) => v !== null && component.has(v);

  // Joined run first, then the rest in their original order.
  const firstPoint = (component) => lineVertices.findIndex((vertices) => vertices.some((v) => component.has(v)));
  components.sort((p, q) => {
    const rank = (c) => (holds(c, entryVertex) || holds(c, exitVertex) ? 0 : 1);
    return rank(p) - rank(q) || firstPoint(p) - firstPoint(q);
  });

  const plans = components.map((component) => {
    const start = holds(component, entryVertex) ? entryVertex : null;
    let end = holds(component, exitVertex) ? exitVertex : null;
    // A run that only ends at the exit is planned backwards from it.
    if (start === null && end !== null) return { ...planComponent(graph, component, end, null, paths), reversed: true };
    return { ...planComponent(graph, component, start, end, paths), reversed: false };
  });

  let retraced = 0;
  for (const plan of plans) {
    for (const [u, v] of plan.retrace) {
      retraced += paths.get(u).dist[v];
      let w = v;
      while (w !== u) {
        const edge = graph.edges[paths.get(u).via[w]];
        graph.edges.push({ a: edge.a, b: edge.b, used: false });
        w = edge.a === w ? edge.b : edge.a;
      }
    }
  }

  const strokes = plans.map((plan) => {
    const heading = plan.start === entryVertex ? entryHeading : null;
    const route = walk(graph, plan.start, heading);
    return plan.reversed ? route.reverse() : route;
  });

  return { strokes, joinsEntry: entryVertex !== null, joinsExit: exitVertex !== null, stretched, retraced };
}
