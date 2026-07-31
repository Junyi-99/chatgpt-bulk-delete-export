/**
 * Own indicator instead of <input type="checkbox">: we render in ChatGPT's light
 * DOM, and their stylesheet strips the native checkbox appearance, so the checked
 * state was invisible.
 */
export function Check({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 shrink-0 items-center justify-center self-center rounded-[4px] border"
      style={{
        borderColor: checked ? '#10a37f' : 'currentColor',
        background: checked ? '#10a37f' : 'transparent',
        opacity: checked ? 1 : 0.4,
      }}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="#fff" strokeWidth="2">
          <path d="M2.5 6.3 4.8 8.6 9.5 3.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}
