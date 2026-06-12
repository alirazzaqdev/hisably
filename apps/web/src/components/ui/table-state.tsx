export function TableStateRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td className="px-4 py-6 text-center text-muted-foreground" colSpan={colSpan}>
        {children}
      </td>
    </tr>
  );
}

export function TableErrorRow({ colSpan, message = "Something went wrong. Please try again." }: { colSpan: number; message?: string }) {
  return (
    <tr>
      <td className="px-4 py-6 text-center text-danger-500" colSpan={colSpan}>
        {message}
      </td>
    </tr>
  );
}
