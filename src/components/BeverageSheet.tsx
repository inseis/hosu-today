import { useEffect, useRef, useState } from 'react';
import catalog from '../../data/catalog/catalog.json';
import { Icon } from './ui';

interface Props {
  open: boolean;
  products: string[];
  draftOnly: boolean;
  onApply(products: string[], draftOnly: boolean): void;
  onClose(): void;
}

/** 하단 선택창. 선택은 선택 사항이며 아무것도 고르지 않아도 모든 업소를 볼 수 있다. */
export function BeverageSheet({ open, products, draftOnly, onApply, onClose }: Props) {
  const [sel, setSel] = useState(products);
  const [draft, setDraft] = useState(draftOnly);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      setSel(products);
      setDraft(draftOnly);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open, products, draftOnly]);

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby="bev-sheet-title"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <div className="sheet-inner">
        <div className="sheet-head">
          <h2 id="bev-sheet-title">음료 선택</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <Icon name="close" />
          </button>
        </div>
        <p className="sheet-help">업소가 취급을 확인한 제품 기준입니다. 선택하지 않으면 모든 업소를 보여줍니다.</p>
        <fieldset className="chip-grid">
          <legend className="sr-only">제품</legend>
          {catalog.beverageProducts.filter((p) => (p as { selectable?: boolean }).selectable !== false).map((p) => (
            <label key={p.id} className={`chip chip-check${sel.includes(p.id) ? ' is-on' : ''}`}>
              <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} />
              {sel.includes(p.id) && <Icon name="check" size={16} />}
              {p.label}
            </label>
          ))}
        </fieldset>
        <label className={`chip chip-check chip-wide${draft ? ' is-on' : ''}`}>
          <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
          {draft && <Icon name="check" size={16} />}
          생맥주로 제공하는 곳만
        </label>
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={() => { setSel([]); setDraft(false); }}>
            선택 해제
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onApply(sel, draft)}>
            적용
          </button>
        </div>
      </div>
    </dialog>
  );
}
