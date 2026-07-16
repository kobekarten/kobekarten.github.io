/* ============================================================================
   argmap-backdrop.js — decorative argument map that builds itself over time
   ----------------------------------------------------------------------------
   Ornamental only. Starts from a root claim and adds one argument at a time,
   each attaching to an existing node. The tree re-lays-out as it grows, with
   existing nodes easing to their new slots. At `maxNodes` it holds, fades, and
   starts a fresh debate. Arrows point UP toward the parent, like Argdown.

   USAGE
     <div class="argmap-hero"><h1>My site</h1></div>
     ArgmapBackdrop.mountAll('.argmap-hero', { opacity: .3 });

   The host needs `position:relative; overflow:hidden`; your content wants
   `position:relative; z-index:1` so it sits above the backdrop.

   OPTIONS (all optional)
     opacity      .35   opacity of the backdrop layer
     roots        1     starting claims
     maxNodes     14    stop growing here (the "threshold")
     maxDepth     4     deepest row allowed
     maxChildren  3     max branches per node
     growEvery    900   ms between new arguments (+/- growJitter)
     growJitter   350
     crossLinkChance .1 chance a new node also attacks/supports a second node
     arrows       true
     hold         2600  ms to sit at full size before fading
     fade         900   ms fade-out
     loop         true  start a new debate afterwards (false = grow once, keep)
     drift        true  slow parallax drift
     width/height 1200 / 380   viewBox; scales to fill the host
     colors       { support, attack, node, stroke }

   With prefers-reduced-motion it draws one finished map, static, no loop.
   ========================================================================== */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var STYLE_ID = 'amb-style';

  function rnd(a, b){ return a + Math.random() * (b - a); }
  function ri(a, b){ return Math.floor(rnd(a, b + 1)); }
  function pick(a){ return a[ri(0, a.length - 1)]; }
  function reduceMotion(){
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function injectCSS(){
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style'); s.id = STYLE_ID;
    s.textContent =
      '@keyframes amb-drift{0%{transform:translate3d(0,0,0)}50%{transform:translate3d(-12px,6px,0)}100%{transform:translate3d(0,0,0)}}' +
      '.amb-svg{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:0}' +
      '.amb-drift{animation:amb-drift 28s ease-in-out infinite}';
    document.head.appendChild(s);
  }

  function mount(host, opts){
    if (!host || host.dataset.ambMounted) return;
    host.dataset.ambMounted = '1';
    injectCSS();

    var o = {
      opacity: .35, roots: 1, maxNodes: 14, maxDepth: 4, maxChildren: 3,
      nodeW: [42, 68], nodeH: [15, 20], rowGap: 0,   // rowGap 0 = derive from height
      growEvery: 900, growJitter: 350, crossLinkChance: .1, arrows: true,
      hold: 2600, fade: 900, loop: true, drift: true,
      width: 1200, height: 380, colors: {}
    };
    for (var k in (opts || {})) o[k] = opts[k];
    var C = { support: '#2f8f5b', attack: '#cf4b3e', node: 'currentColor', stroke: 'currentColor' };
    for (var c in (o.colors || {})) C[c] = o.colors[c];

    var W = o.width, H = o.height, motion = !reduceMotion();

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', o.preserveAspectRatio || 'xMidYMid slice');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'amb-svg');
    svg.style.opacity = o.opacity;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.insertBefore(svg, host.firstChild);

    var root = document.createElementNS(NS, 'g');
    if (motion && o.drift) root.setAttribute('class', 'amb-drift');
    var edgeLayer = document.createElementNS(NS, 'g');     // edges under nodes
    var nodeLayer = document.createElementNS(NS, 'g');
    root.appendChild(edgeLayer); root.appendChild(nodeLayer);
    svg.appendChild(root);

    var nodes, edges, roots, phase, phaseT, nextGrow, raf = null, last = 0;

    /* ---- model ---------------------------------------------------------- */
    function makeNode(rank, parent){
      var n = {
        rank: rank, parent: parent || null, children: [],
        w: rnd(o.nodeW[0], o.nodeW[1]), h: rnd(o.nodeH[0], o.nodeH[1]),
        jx: rnd(-8, 8), jy: rnd(-7, 7),
        appear: 0, cx: 0, cy: 0, tx: 0, ty: 0
      };
      var g = document.createElementNS(NS, 'g');
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', -n.w / 2); r.setAttribute('y', -n.h / 2);
      r.setAttribute('width', n.w); r.setAttribute('height', n.h);
      r.setAttribute('rx', '5');
      r.setAttribute('fill', C.node); r.setAttribute('fill-opacity', '.10');
      r.setAttribute('stroke', C.stroke); r.setAttribute('stroke-opacity', '.5');
      r.setAttribute('stroke-width', '1.2');
      g.appendChild(r);
      g.style.opacity = '0';                                // never paints raw
      n.el = g;
      if (parent){ parent.children.push(n); n.cx = parent.cx; n.cy = parent.cy; }  // emerges from its parent
      nodes.push(n); nodeLayer.appendChild(g);
      return n;
    }

    function makeEdge(from, to, kind){
      var e = { from: from, to: to, kind: kind, draw: 0, head: 0, soff: 0, toff: 0, dashed: true };
      var col = kind === 'support' ? C.support : C.attack;
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', col);
      p.setAttribute('stroke-width', '1.4'); p.setAttribute('stroke-linecap', 'round');
      p.style.opacity = '0';
      e.path = p; edgeLayer.appendChild(p);
      if (o.arrows){
        var h = document.createElementNS(NS, 'polygon');
        h.setAttribute('points', '0,0 -7.5,-3 -7.5,3');
        h.setAttribute('fill', col);
        h.style.opacity = '0';
        e.headEl = h; edgeLayer.appendChild(h);
      }
      edges.push(e);
      return e;
    }

    /* ---- layout: leaves take slots, parents centre over their children ---- */
    function layout(){
      var cursor = 0;
      function place(n){
        if (!n.children.length){ n.slot = cursor++; return n.slot; }
        var xs = n.children.map(place);
        n.slot = (xs[0] + xs[xs.length - 1]) / 2;
        return n.slot;
      }
      roots.forEach(function (r){ place(r); cursor += 1; });

      var minS = Infinity, maxS = -Infinity;
      nodes.forEach(function (n){ if (n.slot < minS) minS = n.slot; if (n.slot > maxS) maxS = n.slot; });
      var spanS = maxS - minS;
      var padX = 80, padY = 46;
      var rowStep = o.rowGap || (H - padY * 2) / Math.max(o.maxDepth - 1, 1);
      var topY = o.rowGap
        ? Math.max((H - rowStep * (o.maxDepth - 1)) / 2, padY * .5)   // centre the tree
        : padY;
      nodes.forEach(function (n){
        n.tx = spanS > 0 ? padX + ((n.slot - minS) / spanS) * (W - padX * 2) + n.jx : W / 2 + n.jx;
        n.ty = topY + n.rank * rowStep + n.jy;
      });

      // fan each node's incoming/outgoing edges so arrowheads don't merge
      nodes.forEach(function (n){ n._in = []; n._out = []; });
      edges.forEach(function (e){ e.to._in.push(e); e.from._out.push(e); });
      function fan(list, node, key, by){
        list.sort(function (a, b){ return by(a) - by(b); });
        var span = Math.min(Math.max(node.w - 14, 0), (list.length - 1) * 16);
        list.forEach(function (e, i){
          e[key] = list.length === 1 ? 0 : -span / 2 + span * (i / (list.length - 1));
        });
      }
      nodes.forEach(function (n){
        fan(n._in,  n, 'toff', function (e){ return e.from.tx; });
        fan(n._out, n, 'soff', function (e){ return e.to.tx; });
      });
    }

    /* ---- growth: one new argument joins the map --------------------------- */
    function grow(){
      var cand = nodes.filter(function (n){
        return n.rank < o.maxDepth - 1 && n.children.length < o.maxChildren && n.appear > .5;
      });
      if (!cand.length) return false;
      // mild bias toward nodes that don't have many children yet
      var parent = cand[0], best = -1;
      cand.forEach(function (n){
        var w = Math.random() / (1 + n.children.length);
        if (w > best){ best = w; parent = n; }
      });

      var child = makeNode(parent.rank + 1, parent);
      makeEdge(child, parent, Math.random() < .6 ? 'support' : 'attack');

      if (Math.random() < o.crossLinkChance){                 // also bears on a second node
        var others = nodes.filter(function (n){ return n.rank === parent.rank && n !== parent; });
        if (others.length) makeEdge(child, pick(others), Math.random() < .4 ? 'support' : 'attack');
      }
      layout();
      return true;
    }

    function reset(){
      while (edgeLayer.firstChild) edgeLayer.removeChild(edgeLayer.firstChild);
      while (nodeLayer.firstChild) nodeLayer.removeChild(nodeLayer.firstChild);
      nodes = []; edges = []; roots = [];
      for (var i = 0; i < Math.max(o.roots, 1); i++) roots.push(makeNode(0, null));
      layout();
      nodes.forEach(function (n){ n.cx = n.tx; n.cy = n.ty; });   // roots start in place
      phase = 'grow'; phaseT = 0; nextGrow = o.growEvery * .35;
      root.style.opacity = '1';
    }

    /* ---- per-frame render ------------------------------------------------- */
    function render(dt){
      var k = Math.min(dt / 200, 1);                          // position easing

      nodes.forEach(function (n){
        n.cx += (n.tx - n.cx) * k;
        n.cy += (n.ty - n.cy) * k;
        n.appear = Math.min(n.appear + dt / 450, 1);
        var e = n.appear, s = .85 + .15 * (1 - Math.pow(1 - e, 3));
        n.el.setAttribute('transform', 'translate(' + n.cx + ',' + n.cy + ') scale(' + s + ')');
        n.el.style.opacity = String(e);
      });

      edges.forEach(function (e){
        var c = e.from, p = e.to;
        var x1 = c.cx + e.soff, y1 = c.cy - c.h / 2;
        var x2 = p.cx + e.toff, y2 = p.cy + p.h / 2 + 5;
        var dx = x2 - x1, bend = Math.max((y1 - y2) * .42, 14);
        var c1x = x1 + dx * .18, c1y = y1 - bend;
        var c2x = x2 - dx * .18, c2y = y2 + bend;
        e.path.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + c1x + ',' + c1y + ' ' + c2x + ',' + c2y + ' ' + x2 + ',' + y2);

        if (c.appear > .35) e.draw = Math.min(e.draw + dt / 700, 1);
        if (e.draw < 1){
          var len = 0;
          try { len = e.path.getTotalLength(); } catch (_) {}
          if (!len || !isFinite(len)) len = (Math.abs(dx) + Math.abs(y1 - y2)) * 1.4 + 24;
          e.path.style.strokeDasharray = len;
          e.path.style.strokeDashoffset = len * (1 - e.draw);
        } else if (e.dashed){                                  // done: drop the dash so
          e.path.style.strokeDasharray = 'none';               // relayout can move it freely
          e.path.style.strokeDashoffset = '0';
          e.dashed = false;
        }
        e.path.style.opacity = String(.6 * Math.min(e.draw * 4, 1));

        if (e.headEl){                                         // arrowhead: angled, and only
          if (e.draw >= 1) e.head = Math.min(e.head + dt / 250, 1);   // after the line lands
          var ang = Math.atan2(y2 - c2y, x2 - c2x) * 180 / Math.PI;
          e.headEl.setAttribute('transform', 'translate(' + x2 + ',' + y2 + ') rotate(' + ang + ')');
          e.headEl.style.opacity = String(.75 * e.head);
        }
      });
    }

    function frame(now){
      var dt = Math.min(now - last, 64); last = now;

      if (phase === 'grow'){
        nextGrow -= dt;
        if (nextGrow <= 0){
          if (nodes.length >= o.maxNodes || !grow()){ phase = 'hold'; phaseT = o.hold; }
          else nextGrow = Math.max(o.growEvery + rnd(-o.growJitter, o.growJitter), 120);
        }
      } else if (phase === 'hold'){
        phaseT -= dt;
        if (phaseT <= 0){
          if (!o.loop){ render(dt); raf = null; return; }
          phase = 'fade'; phaseT = o.fade;
        }
      } else if (phase === 'fade'){
        phaseT -= dt;
        root.style.opacity = String(Math.max(phaseT / o.fade, 0));
        if (phaseT <= 0){ reset(); }
      }

      render(dt);
      raf = requestAnimationFrame(frame);
    }

    function start(){
      reset();
      if (!motion){                                            // static: one finished map
        var guard = 0;
        while (nodes.length < o.maxNodes && guard++ < 200 && grow()){}
        nodes.forEach(function (n){ n.cx = n.tx; n.cy = n.ty; n.appear = 1; });
        edges.forEach(function (e){ e.draw = 1; e.head = 1; });
        render(16);
        return;
      }
      last = (global.performance ? performance.now() : Date.now());
      raf = requestAnimationFrame(frame);
    }

    start();

    return {
      restart: start,
      destroy: function (){
        if (raf) cancelAnimationFrame(raf);
        svg.remove(); delete host.dataset.ambMounted;
      }
    };
  }

  function mountAll(selector, opts){
    Array.prototype.forEach.call(document.querySelectorAll(selector || '.argmap-hero'),
      function (el){ mount(el, opts); });
  }

  global.ArgmapBackdrop = { mount: mount, mountAll: mountAll };
})(window);
