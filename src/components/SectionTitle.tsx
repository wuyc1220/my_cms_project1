interface SectionTitleProps {
  title: string
}

export default function SectionTitle({ title }: SectionTitleProps) {
  return (
    <div
      style={{
        borderLeft: '3px solid #1677ff',
        paddingLeft: 12,
        marginBottom: 16,
        fontSize: 16,
        fontWeight: 600,
      }}
    >
      {title}
    </div>
  )
}
