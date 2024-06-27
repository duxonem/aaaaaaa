// ==UserScript==
// @name   Vietphrase converter
// @namespace  VP
// @version  0.0.4
// @description The userscript converts chinese novel webpage to Vietphrase format to read on web browser 
// @author you
// @match  http*://*/*
// @grant  GM_setValue
// @grant  GM_getValue
// @grant  GM_deleteValue
// @run-at   document-idle
// ==/UserScript==

let Options = GM_getValue('Options', {
  Ngoac: false,
  Motnghia: true,
  daucach: ';',
  DichLieu: true,
  useSP: false,
  font:'Roboto'
});

let dictNames = GM_getValue('dictNames', undefined);
let dictVP = GM_getValue('dictVP', undefined);
let dictPA = GM_getValue('dictPA', undefined);
let dictSP = GM_getValue('dictSP', undefined);

let tmpDictPA;
let tmpDictVP;
let tmpDictNames;
let tmpDictSP;

function findNonInline(el) {
  for(let i = el; i != null; i = i.parentElement) {
    if(i.tagName == 'IMG' || i.tagName == 'VIDEO') return false;
    const icss = window.getComputedStyle(i)
    el = i
    if(icss['display'] != 'inline') break
  }
  return el;
}

//https://github.com/lilydjwg/text-reflow-we
function reFlow(e) {
  const sideMargin = 10
  const winWidth = window.visualViewport.width
  let target = findNonInline(e.target);
  if (!target) return;
  const bbox = target.getBoundingClientRect()

  // if box is wider than screen, reset width to make it fit
  if(bbox.width > winWidth) {
    const newWidth = winWidth - (2*sideMargin)
    target.style.width = newWidth + 'px'
    target.__reflowed = true
  } else if(target.__reflowed) { // don't remove width set by the page itself
    target.style.width = ''
    target.__reflowed = false
  }
}

function isOverflow(el) { return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth; }
function reflow(el) {
  const smallestSize = 12;
  let count = 1;
  let computedStyle;
  do {
    count++;
    computedStyle = getComputedStyle(el)
    fontSize = parseInt(computedStyle.fontSize.slice(0, -2));
    fontSize = fontSize * .95;
    el.style.fontSize = fontSize + 'px';
  } while (isOverflow(el) && fontSize > smallestSize && count < 10)
}

function sortSP(a, b) {
  let cmp = { 'V': 2, 'N': 3 }
  let aM = a.match(/{\d}|{N\d?}|{V\d?}/g);
  let bM = b.match(/{\d}|{N\d?}|{V\d?}/g);
  if (aM.length > bM.length) return -1;
  if (aM.length < bM.length) return 1;
  let aS = aM.reduce((s, e) => s += cmp[e.charAt(0)] ?? 0, 0);
  let bS = bM.reduce((s, e) => s += cmp[e.charAt(0)] ?? 0, 0);
  if (aS > bS) return -1;
  if (aS < bS) return 1;
  return b.length - a.length || a.localeCompare(b);
}

function str2Dict(str) {
  let dict = {};
  str.trim().split('\n').forEach(line => {
    if (/^(\/\/|#|=)/.test(line)) return; //ghi chu
    let [org, trans] = line.split('=');
    if (!org || !trans) return;
    dict[org] = trans.trim();
  })
  return dict
}

function transPA(str) {
  return str.split('').reduce((s, c) => s += dictPA.trans[c] ? (' ' + dictPA.trans[c]) : c, '');
}

function transVP(str, Ngoac = true, Motnghia = false, daucach = ';', DichLieu = false) {
  const _magic = ''; //'\uf0f3'
  if (dictNames) dictNames.org?.forEach(el => str.replaceAll(el, ' ' + dictNames.trans[el]));
  if (!dictVP || !dictPA) return str;
  let result = '';
  const maxLength = dictVP.org[0]?.length;
  const dichlieu = ['的', '了', '着'];
  for (let i = 0; i < str.length; i++) {
    for (let j = maxLength; j > 0; j--) {
      let subStr = str.slice(i, i + j);

      let VP = dictVP.trans[subStr];
      if (VP) {
        if (Motnghia) VP = VP.split(daucach)[0];
        if (Ngoac) VP = `[${VP.toString().trim()}]`;//Sometimes VP.trim() got error because no trim property/function in VP???
        result += ' ' + VP;
        str.replace(subStr, _magic.repeat(subStr.length));
        i += j;
      }
      if (j == 1) {
        if (DichLieu && dichlieu.includes(str.charAt(i))) continue;
        result += dictPA.trans[str.charAt(i)] ? (' ' + dictPA.trans[str.charAt(i)]) : str.charAt(i);
        str.replace(str.charAt(i), _magic);
      }
    }
  }
  return result.replaceAll(/[ ]+/g, ' ');
}

function transSP1(str) {
  const regNumber = /{\d}/g
  if (dictSP.org == undefined) return false;
  dictSP.org.forEach(sp => {
    let aC = sp.match(regNumber);
    let vC = new RegExp(sp.replaceAll(regNumber, '[\\p{sc=Han}、，,0-9]+'), 'ug');
    let vV = dictSP.trans[sp];
    aC.forEach(ac => vV = vV.replace(ac, `$${aC.indexOf(ac) + 1}`));
    str.replaceAll(vC, `<${vV}>`);
  })
}
const transSP = transSP1;

function translateNode(rootNode) {
  let nodeArr = [];
  let nodesText = '';
  const limiter = ''.repeat(2); //'\uf0f5'

  function nodeToArr(node) {
    if (node.nodeType == 3) {
      nodeArr.push(node);
      nodesText += node.textContent + limiter;
      // nodesText += node.nodeValue + limiter;
    }
    node.childNodes.forEach((childNode) => nodeToArr(childNode))
  }

  nodeToArr(rootNode);
  transVP(nodesText, Options.Ngoac, Options.Motnghia, Options.daucach, Options.DichLieu)
    .split(limiter).forEach((text, index) => {
    if (nodeArr[index] == undefined) return;
    nodeArr[index].textContent = text;
    // nodeArr[index].nodeValue = text;
    if (Options.font)
    nodeArr[index].parentElement?nodeArr[index].parentElement.style=`font-family: ${Options.font} !important`:'';

    let  el=findNonInline(nodeArr[index].parentElement);

    if (isOverflow(el)) reflow(el);
    for (c of el.children) {
      let fS=parseInt(getComputedStyle(c).fontSize.slice(0,-2));
      if (fS<12) c.style.fontSize='12px';
    }
    if (isOverflow(el)) el.style.overflow='hidden';
  });
}

async function fileLoad(event) {
  let txt = '';
  let tmp;
  if (event.target.files[0]) txt = await event.target.files[0].text(); else return false;
  switch (event.target.id) {
    case 'fPA':
      tmpDictPA = {};
      tmpDictPA.trans = str2Dict(txt); break;

    case 'fVP':
      tmpDictVP = {};
      tmpDictVP.trans = str2Dict(txt);
      tmpDictVP.org = [];
      tmpDictVP.org[0] = Object.keys(tmpDictVP.trans).toSorted((a, b) => b.length - a.length || a.localeCompare(b))[0] ?? '';
      break;

    case 'fNames':
      tmpDictNames = {};
      tmpDictNames.trans = str2Dict(txt);
      tmpDictNames.org = Object.keys(tmpDictNames.trans).toSorted((a, b) => b.length - a.length || a.localeCompare(b));
      break;

    case 'fSP':
      tmpDictSP = {};
      tmpDictSP.trans = str2Dict(txt);
      tmpDictSP.org = Object.keys(tmpDictSP.trans).toSorted(sortSP);
      break;
  }
}

(async function () {
  'use strict';
  if (window.self != window.top) return;

  document.body.insertAdjacentHTML('beforeend', `
<style>
  div.usButton {
    display: flex;
    position: fixed;
    top: 1%;
    right: 1%;
    margin: 0;
    padding: 0;
    border: thin;
    z-index: 9999;
  }

  div.usButton>button {
    height: 90%;
    border: none;
    margin: 0;
    text-align: right;
  }

  div.usButton>button:first-child {
    padding: 5px 0px 5px 5px;
  }

  div.usButton>button:last-child {
    padding: 5px 2px 5px 0px;
  }

  div.usButton>button:nth-child(2) {
    padding: 5px 2px 5px 0px;
  }

  dialog#usDialog {
    border: none;
    border-radius: .3rem;
    font-family: Arial;
    padding: .3rem;
    margin: auto;
  }

  dialog#usDialog>fieldset {
    text-align: left;
  }

  dialog#usDialog>div {
    display: flex;
    justify-content: space-around;
  }

  dialog#usDialog>div>button {
    width: 3rem;
  }

  label:has(#cbMotnghia)+label {
    display: none;
  }

  label:has(#cbMotnghia:checked)+label {
    display: unset;
  }
</style>
<div class="usButton">
  <button>Tran</button>
  <button>slate</button>
  <button>↓</button>
</div>
<dialog id="usDialog" spellcheck="false" lang="vie">
  <fieldset>
    <legend>Từ điển</legend>
    <label for="fPA">Phiên Âm&nbsp;&nbsp;&nbsp;<input type="file" id="fPA"></label><br />
    <label for="fVP">Vietphrase&nbsp;<input type="file" id="fVP"></label><br />
    <label for="fNames">Names&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<input type="file" id="fNames"></label><br />
    <label for="fSP">Strucphrase <input type="file" id="fSP"></label><br />
  </fieldset>
  <fieldset>
    <legend>Tùy chọn dịch</legend>
    <label for="cbNgoac"><input type="checkbox" id="cbNgoac"> Dùng [ngoặc]</label><br />
    <label for="cbMotnghia"><input type="checkbox" id="cbMotnghia"> Một nghĩa</label>
    <label for="txtdaucach">, dấu cách nghĩa<input type="text" id="txtdaucach" size="1" maxlength="1"></label><br />
    <label for="cbDichLieu"><input type="checkbox" id="cbDichLieu"> Xóa "đích, liễu, trứ"</label><br />
    <label for="cbSP"><input type="checkbox" id="cbSP"> Dùng Strucphrase</label><br />
    <label for="txtfont">Font thay thế: <input type="text" id="txtfont"></label><br />
  </fieldset>
  <div>
    <button>OK</button>
    <button onclick="this.parentElement?.parentElement?.close()">Cancel</button>
  </div>
</dialog>`);

  const dialog = document.querySelector('dialog#usDialog');
  dialog.previousElementSibling.firstElementChild.onclick = () => {
    console.time('Translate 1');
    document.title = transPA(document.title);
    document.body.innerHTML = transVP(document.body.innerHTML, Options.Ngoac, Options.Motnghia, Options.daucach, Options.DichLieu);
    if (Options.font)
      document.querySelector('body').setAttribute('style',`font-family: ${Options.font} !important;`);
    console.timeEnd('Translate 1');
  }

  dialog.previousElementSibling.firstElementChild.nextElementSibling.onclick = () => {
    console.time('Translate 2');
    document.title = transPA(document.title);
    translateNode(document.body);
    console.timeEnd('Translate 2');
  }

  dialog.previousElementSibling.lastElementChild.onclick = () => { // Menu ↓ button
    tmpDictPA = undefined;
    tmpDictVP = undefined;
    tmpDictNames = undefined;
    tmpDictSP = undefined;
    if (dialog.open) dialog.close();

    dialog.querySelectorAll('input[type="file"]').forEach(el => el.value = null);
    dialog.querySelector('#cbNgoac').checked = Options.Ngoac;
    dialog.querySelector('#cbMotnghia').checked = Options.Motnghia;
    dialog.querySelector('#cbDichLieu').checked = Options.DichLieu;
    dialog.querySelector('#cbSP').checked = Options.useSP;
    dialog.querySelector('#txtdaucach').value = Options.daucach;
    dialog.querySelector('#txtfont').value = Options.font;
    dialog.showModal();
  }

  dialog.querySelectorAll('input[type="file"]').forEach(el => el.onchange = fileLoad);
  dialog.querySelector('div>button').onclick = () => {  //OK button
    if (tmpDictPA != undefined) {
      dictPA = tmpDictPA;
      GM_setValue('dictPA', dictPA)
    }

    if (tmpDictVP != undefined) {
      dictVP = tmpDictVP;
      GM_setValue('dictVP', dictVP)
    }

    if (tmpDictNames != undefined) {
      dictNames = tmpDictNames;
      GM_setValue('dictNames', dictNames)
    }

    if (tmpDictSP != undefined) {
      dictSP = tmpDictSP;
      GM_setValue('dictSP', dictSP)
    }

    Options.Ngoac = dialog.querySelector('#cbNgoac').checked;
    Options.Motnghia = dialog.querySelector('#cbMotnghia').checked;
    Options.DichLieu = dialog.querySelector('#cbDichLieu').checked;
    Options.useSP = dialog.querySelector('#cbSP').checked;
    Options.daucach= dialog.querySelector('#txtdaucach').value.charAt(0)??';';
    Options.font=Options.daucach= dialog.querySelector('#txtfont').value.trim().split(/[,;]/g)[0]//??'Roboto';
    GM_setValue('Options', Options);
    dialog.close();
  }

  document.addEventListener('click', reFlow);
})();
