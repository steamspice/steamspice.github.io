// Ingredients (Step 4s, D-073): the shared list products pick from. Renaming reaches every product; deleting removes it from them.
import { api } from './shell.js';
import { backToProducts } from './manage.js';
import { confirmDialog, el, feedback, saving, toast } from './dom.js';

const root = document.querySelector('[data-root]');
let list = []; let query = '';

function row(i) {
  const input = el('input', { type: 'text', value: i.name, maxLength: 60, 'aria-label': `Name of ingredient ${i.name}` });
  const actions = el('div', { className: 'btn-row' });
  const save = el('button', { type: 'button', className: 'btn btn-small' }, 'Rename');
  const fb = feedback(actions);
  const rename = () => saving(save, fb, async () => { await api.saveIngredient({ id: i.id, name: input.value }); await draw(); });
  save.addEventListener('click', rename);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); rename(); } });
  const del = el('button', { type: 'button', className: 'btn btn-danger btn-small' }, 'Delete');
  del.addEventListener('click', async () => {
    const message = i.product_count ? `${i.product_count} product${i.product_count === 1 ? ' uses' : 's use'} this ingredient. It will be removed from ${i.product_count === 1 ? 'it' : 'them'}. Orders already placed keep what they were placed with.` : 'No product uses it.';
    if (!(await confirmDialog({ title: `Delete "${i.name}"?`, message, confirmLabel: 'Delete ingredient', danger: true }))) return;
    try { await api.deleteIngredient(i.id); toast(`"${i.name}" was deleted.`, { seconds: 4 }); await draw(); } catch (e) { toast(e.message); }
  });
  actions.prepend(save, del);
  return el('article', { className: 'panel category-row' }, input, el('p', { className: 'muted' }, `Used on ${i.product_count} product${i.product_count === 1 ? '' : 's'}`), actions);
}

async function draw() {
  list = await api.listIngredients();
  const name = el('input', { type: 'text', maxLength: 60, placeholder: 'For example Onion', 'aria-label': 'New ingredient name' });
  const addRow = el('div', { className: 'btn-row' }); const fb = feedback(addRow);
  const add = el('button', { type: 'button', className: 'btn' }, 'Add ingredient');
  const doAdd = () => saving(add, fb, async () => { await api.saveIngredient({ name: name.value }); name.value = ''; await draw(); });
  add.addEventListener('click', doAdd);
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
  addRow.prepend(add);
  const search = el('input', { type: 'search', placeholder: 'Search', 'aria-label': 'Search ingredients', value: query });
  const results = el('div');
  const drawResults = () => {
    const q = query.trim().toLowerCase();
    const shown = list.filter((i) => !q || i.name.toLowerCase().includes(q));
    results.replaceChildren(...(shown.length ? shown.map(row) : [el('p', { className: 'muted empty-state' }, list.length ? 'Nothing matches your search.' : 'No ingredients yet. Add the first one above, or add them from a product.')]));
  };
  search.addEventListener('input', () => { query = search.value; drawResults(); });
  drawResults();
  root.replaceChildren(backToProducts(), el('div', { className: 'title-row' }, el('h1', {}, 'Ingredients')),
    el('p', { className: 'muted' }, 'One list for all products. On each product you choose which are always included and which customers can leave out.'),
    el('section', { className: 'panel' }, el('h2', {}, 'New ingredient'), el('div', { className: 'field' }, el('label', {}, 'Name', name)), addRow),
    search, results);
}
await draw();
