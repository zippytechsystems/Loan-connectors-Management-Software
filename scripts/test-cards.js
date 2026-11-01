const fs = require('fs');

const html = fs.readFileSync('public/app.html', 'utf8');
const js = fs.readFileSync('public/js/app.js', 'utf8');

const cards = [
  { id: 'card-profile', modal: 'modal-zippy-profile' },
  { id: 'card-partners', modal: 'modal-zippy-partners' },
  { id: 'card-feedback', modal: 'modal-zippy-feedback' },
  { id: 'card-reminders', modal: 'modal-zippy-reminders' },
  { id: 'card-lender-match', modal: 'modal-zippy-lenders' },
  { id: 'card-ai-underwriter', modal: 'modal-zippy-ai' },
  { id: 'card-new-lead', modal: 'modal-zippy-new-lead' },
  { id: 'card-lead-queue', modal: 'modal-zippy-lead-queue' },
  { id: 'card-payouts', modal: 'modal-zippy-payouts' },
  { id: 'card-commissions', modal: 'modal-zippy-commissions' },
  { id: 'card-analytics', modal: 'modal-zippy-analytics' },
  { id: 'card-doc-review', modal: 'modal-zippy-doc-review' },
  { id: 'card-circulars', modal: 'modal-zippy-circulars' },
  { id: 'card-products', modal: 'modal-zippy-products' },
  { id: 'card-doc-vault', modal: 'modal-zippy-vault' }
];

console.log('Testing cards and modal mappings:');
for (const c of cards) {
  const cardInHtml = html.includes(`id="${c.id}"`);
  const modalInHtml = html.includes(`id="${c.modal}"`);
  const listenerInJs = js.includes(c.id);
  console.log(`${c.id} -> ${c.modal}: CardInHtml=${cardInHtml}, ModalInHtml=${modalInHtml}, ListenerInJs=${listenerInJs}`);
}
