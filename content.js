// AI Detector v1.0 — content script
// Built by Gemini (gemini-3-flash-preview) from a spec, reviewed and patched by Muse:
//  1) too-short text no longer counts toward the overall score (present:false)
//  2) generator fingerprints match on word boundaries (avoids 'flux' in 'influx', 'imagen' in 'imagenes')
//  3) <code> inside <pre> is not double-counted
//  4) inline scripts read via textContent (innerText is unreliable on script elements)
//  5) scoreCode guards against undefined input
//  6) Recalibrated 2026-11-12: bands 0-31 green / 32-55 yellow / 56+ red
//     (red anchored at 56, the score of a heavily AI-styled synthetic sample).
//  7) Recalibrated again 2026-11-12: bands 0-24 green / 25-34 yellow / 35+ red
//     (red from 35 after a real AI-slop page scored only 39).
//  8) Simplified 2026-11-12 (v1.1.0): binary verdict only. One threshold
//     (AI_THRESHOLD = 35) decides red/green; the popup shows no numbers,
//     percentages, or bands — just the verdict sentence. Scores are kept
//     internally only, to make the decision.
// No network calls, no model, nothing leaves the browser.

(function () {
  'use strict';

  const scorers = {
    /**
     * TEXT SCORING
     */
    scoreText: (text) => {
      const words = text.match(/\p{L}+/gu) || [];
      const sentences = text.split(/[.!?]+(?:\s+|\n+|$)/u).filter(s => s.trim().length > 0);

      if (words.length < 40 || sentences.length < 3) {
        return { present: false, score: 0, band: 'too-short', signals: [{ name: 'Insufficient text', value: words.length + ' words', points: 0 }] };
      }

      let points = 0;
      const signals = [];

      // 1. Uniform sentence length (CV)
      const lengths = sentences.map(s => (s.match(/\p{L}+/gu) || []).length);
      const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const variance = lengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / lengths.length;
      const cv = mean === 0 ? 0 : Math.sqrt(variance) / mean;
      // CV >= 0.9 is human; low CV means robotic uniformity
      const cvPoints = Math.max(0, Math.min(30, (0.9 - cv) / 0.9 * 30));
      points += cvPoints;
      signals.push({ name: 'Sentence length uniformity', value: cv.toFixed(2), points: Math.round(cvPoints) });

      // 2. Stock AI phrases
      const aiPhrases = [
        'in conclusion', 'moreover', 'furthermore', 'delve', 'it is important to note',
        'as an ai', 'as a language model', 'tapestry', 'landscape', 'crucial role',
        'seamless', 'cutting-edge', 'game-changer', 'dive into', "in today's fast-paced world",
        'additionally', 'in summary', 'a testament to', 'navigate the complexities', 'unlock the potential'
      ];
      let foundPhrases = 0;
      const lowerText = text.toLowerCase();
      aiPhrases.forEach(p => { if (lowerText.includes(p)) foundPhrases++; });
      const phrasePoints = Math.min(25, foundPhrases * 5);
      points += phrasePoints;
      signals.push({ name: 'Stock AI phrasing', value: foundPhrases + ' patterns', points: phrasePoints });

      // 3. Low lexical diversity (TTR)
      const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
      const ttr = uniqueWords / words.length;
      // TTR >= 0.55 is human; lower means repetitive vocabulary
      const ttrPoints = Math.max(0, Math.min(25, (0.55 - ttr) / 0.55 * 25));
      points += ttrPoints;
      signals.push({ name: 'Lexical diversity', value: ttr.toFixed(2), points: Math.round(ttrPoints) });

      // 4. Repetitive sentence openers
      const openers = sentences.map(s => (s.trim().split(/\s+/)[0] || '').toLowerCase());
      const counts = {};
      openers.forEach(o => { if (o) counts[o] = (counts[o] || 0) + 1; });
      const maxOpener = Math.max(...Object.values(counts), 0);
      const openerShare = maxOpener / sentences.length;
      // Share <= 0.15 is human
      const openerPoints = Math.max(0, Math.min(20, (openerShare - 0.15) / 0.35 * 20));
      points += openerPoints;
      signals.push({ name: 'Repetitive sentence starts', value: Math.round(openerShare * 100) + '%', points: Math.round(openerPoints) });

      const finalScore = Math.min(100, Math.round(points));
      return { present: true, score: finalScore, band: getBand(finalScore), signals: signals };
    },

    /**
     * IMAGE SCORING — metadata/provenance only, never pixel-level.
     */
    scoreImages: (images) => {
      if (!images || images.length === 0) {
        return { present: false, score: 0, band: 'none', signals: [{ name: 'No images on page', value: '', points: 0 }] };
      }

      let points = 0;
      const signals = [];
      const markers = ['c2pa', 'contentcredentials', 'content-credentials', 'cai.', 'adobe content authenticity'];
      const generators = ['midjourney', 'dall-e', 'dalle', 'stable-diffusion', 'stability.ai', 'firefly', 'leonardo', 'ideogram', 'flux', 'imagen', 'ai-generated', 'ai_generated', 'generated-by-ai', 'openai'];
      const dataAttrs = ['data-ai', 'data-generated', 'data-synthetic', 'data-ai-generated'];

      const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Word-boundary match so 'flux' does not fire on 'influx' and 'imagen' does not fire on 'imagenes'.
      const hasTerm = (blob, term) => new RegExp('(^|[^a-z])' + escapeRegExp(term) + '([^a-z]|$)').test(blob);

      let foundMarker = '';
      let foundGens = new Set();
      let hasDataAttr = false;

      images.forEach(img => {
        const fullblob = ((img.src || '') + ' ' + (img.alt || '') + ' ' + (img.title || '') + ' ' + (img.dataAttrs || '')).toLowerCase();
        markers.forEach(m => { if (fullblob.includes(m)) foundMarker = m; });
        generators.forEach(g => { if (hasTerm(fullblob, g)) foundGens.add(g); });
        dataAttrs.forEach(d => { if ((img.dataAttrs || '').toLowerCase().includes(d)) hasDataAttr = true; });
      });

      if (foundMarker) {
        points += 45;
        signals.push({ name: 'Provenance marker found', value: foundMarker, points: 45 });
      }
      if (foundGens.size > 0) {
        const genPoints = Math.min(35, foundGens.size * 10);
        points += genPoints;
        signals.push({ name: 'AI engine fingerprint', value: Array.from(foundGens).join(', '), points: genPoints });
      }
      if (hasDataAttr) {
        points += 20;
        signals.push({ name: 'AI data attributes', value: 'present', points: 20 });
      }

      if (points === 0) {
        return { present: true, score: 0, band: 'green', signals: [{ name: 'No AI provenance markers found', value: 'Absence is NOT proof of human origin', points: 0 }] };
      }

      const finalScore = Math.min(100, points);
      return { present: true, score: finalScore, band: getBand(finalScore), signals: signals };
    },

    /**
     * CODE SCORING — weak heuristics, always low confidence.
     */
    scoreCode: (samples) => {
      const totalText = (samples || []).map(s => s.text).join('\n');
      if (totalText.length < 200) {
        return { present: false, score: 0, band: 'none', confidence: 'none', signals: [{ name: 'Insufficient code', value: totalText.length + ' chars', points: 0 }] };
      }

      let points = 0;
      const signals = [];
      const lines = totalText.split('\n');

      // 1. Comment ratio
      const commentLines = lines.filter(l => /^\s*(\/\/|\/\*|#|\*)/.test(l)).length;
      const ratio = commentLines / (lines.length || 1);
      const ratioPoints = ratio > 0.35 ? Math.min(25, ((ratio - 0.35) / 0.65) * 25) : 0;
      points += ratioPoints;
      signals.push({ name: 'Comment density', value: Math.round(ratio * 100) + '%', points: Math.round(ratioPoints) });

      // 2. AI-typical phrasing in comments
      const aiCommentPhrases = ['this function', 'this code', 'here we', 'the following', 'step 1', 'step 2'];
      let foundPhrases = 0;
      const lowerCode = totalText.toLowerCase();
      aiCommentPhrases.forEach(p => { if (lowerCode.includes(p)) foundPhrases++; });
      const phrasePoints = Math.min(20, foundPhrases * 5);
      points += phrasePoints;
      signals.push({ name: 'Instructional comments', value: foundPhrases + ' matches', points: phrasePoints });

      // 3. Leftover artifacts
      const artifacts = ['as an ai', 'as a language model', 'certainly!', 'hope this helps', 'let me know if'];
      const hasArtifact = artifacts.some(a => lowerCode.includes(a));
      if (hasArtifact) {
        points += 25;
        signals.push({ name: 'Conversational artifacts', value: 'AI chat leakage', points: 25 });
      }

      // 4. Uniform function length
      const funcBlocks = totalText.match(/^(function|const\s+\w+\s*=|def\s+|class\s+)/gm) || [];
      if (funcBlocks.length >= 4) {
        // Simple heuristic: count lines between identifiers (imperfect but no-dependency)
        const blockLengths = totalText.split(/function|const\s+\w+\s*=|def\s+|class\s+/).map(b => b.split('\n').length);
        const fMean = blockLengths.reduce((a, b) => a + b, 0) / blockLengths.length;
        const fVar = blockLengths.reduce((a, b) => a + Math.pow(b - fMean, 2), 0) / blockLengths.length;
        const fCv = fMean === 0 ? 1 : Math.sqrt(fVar) / fMean;
        const cvPoints = fCv < 0.4 ? Math.min(15, (0.4 - fCv) / 0.4 * 15) : 0;
        points += cvPoints;
        signals.push({ name: 'Structural uniformity', value: 'CV ' + fCv.toFixed(2), points: Math.round(cvPoints) });
      }

      // 5. Generic identifier density
      const idents = totalText.match(/\b[a-zA-Z_]\w*\b/g) || [];
      const generics = idents.filter(id => /^(data|result|temp|tmp|foo|bar|item|value|output|response1?)$/i.test(id));
      const idShare = generics.length / (idents.length || 1);
      const idPoints = idShare > 0.25 ? Math.min(15, ((idShare - 0.25) / 0.75) * 15) : 0;
      points += idPoints;
      signals.push({ name: 'Generic variable usage', value: Math.round(idShare * 100) + '%', points: Math.round(idPoints) });

      const finalScore = Math.min(100, Math.round(points));
      return { present: true, score: finalScore, band: getBand(finalScore), confidence: 'low', signals: signals };
    },

    /**
     * AGGREGATION
     */
    combineScores: (results) => {
      const weights = { text: 0.5, images: 0.25, code: 0.25 };
      let totalWeight = 0;
      let weightedSum = 0;

      ['text', 'images', 'code'].forEach(cat => {
        if (results[cat] && results[cat].present) {
          totalWeight += weights[cat];
          weightedSum += results[cat].score * weights[cat];
        }
      });

      if (totalWeight === 0) return { score: 0, band: 'too-short', categories: results };
      const finalScore = Math.round(weightedSum / totalWeight);
      return { score: finalScore, band: getBand(finalScore), categories: results };
    }
  };

  // Single decision threshold (v1.1.0): the popup shows a binary verdict,
  // so there are no bands anymore — score >= 35 means "uses AI" (red),
  // below means "doesn't use AI" (green). 35 was Shayan's call after a real
  // AI-slop page scored 39 and human pages scored 5-22. Still draft:
  // anchored on few samples, and a binary verdict hides uncertainty on
  // borderline pages. Scores stay internal; the popup never shows them.
  const AI_THRESHOLD = 35;
  const getBand = (s) => (s >= AI_THRESHOLD ? 'red' : 'green');

  const collectPageData = () => {
    // 1. Text
    const bodyClone = document.body.cloneNode(true);
    const selectors = 'script, style, noscript, svg, nav, footer, header, aside, iframe';
    bodyClone.querySelectorAll(selectors).forEach(el => el.remove());
    const visibleText = (bodyClone.innerText || '').replace(/\s+/g, ' ').trim();

    // 2. Images
    const imgs = Array.from(document.images).map(img => ({
      src: img.src || '',
      alt: img.alt || '',
      title: img.title || '',
      dataAttrs: Array.from(img.attributes)
        .filter(a => a.name.startsWith('data-'))
        .map(a => a.name + '=' + a.value).join(' ')
    }));
    // Add meta tags
    document.querySelectorAll('meta').forEach(meta => {
      const name = (meta.getAttribute('name') || meta.getAttribute('property') || '').toLowerCase();
      if (name.includes('generator') || name.includes('contentcredentials')) {
        imgs.push({ src: '', alt: '', title: '', dataAttrs: 'meta:' + name + '=' + (meta.getAttribute('content') || '') });
      }
    });

    // 3. Code
    const codeSamples = [];
    document.querySelectorAll('pre, code').forEach(el => {
      // Skip <code> nested inside <pre> — the <pre> already covers it.
      if (el.tagName.toLowerCase() === 'code' && el.closest('pre')) return;
      const t = el.innerText || '';
      if (t.length > 20) codeSamples.push({ source: 'displayed', text: t });
    });
    document.querySelectorAll('script:not([src])').forEach(el => {
      const t = el.textContent || '';
      if (t.length > 20) codeSamples.push({ source: 'page-source', text: t });
    });

    return { visibleText: visibleText, imgs: imgs, codeSamples: codeSamples };
  };

  // Export for testing
  if (typeof window !== 'undefined') {
    window.__aiDetector = scorers;
  }

  // Runtime listener
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'SCORE_PAGE') {
        try {
          const data = collectPageData();
          const results = {
            text: scorers.scoreText(data.visibleText),
            images: scorers.scoreImages(data.imgs),
            code: scorers.scoreCode(data.codeSamples)
          };
          const final = scorers.combineScores(results);
          sendResponse({ ok: true, result: final });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      }
      return true;
    });
  }
})();
