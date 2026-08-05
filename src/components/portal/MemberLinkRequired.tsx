type MemberLinkRequiredProps = {
  message?: string;
};

export function MemberLinkRequired({
  message = "Seu usuario ainda nao esta vinculado a um cadastro de membro."
}: MemberLinkRequiredProps = {}) {
  return (
    <div className="rounded-md border border-hope-100 bg-white p-6 text-sm font-semibold text-ink-700 shadow-sm">
      {message}
    </div>
  );
}
