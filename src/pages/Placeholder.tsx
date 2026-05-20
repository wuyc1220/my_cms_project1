import { Result } from 'antd'
import { useI18n } from '../i18n/useI18n'

interface Props {
  title: string
}

export default function Placeholder({ title }: Props) {
  const { t } = useI18n()
  return (
    <Result
      status="info"
      title={title}
      subTitle={t('placeholder.inDevelopment')}
      style={{ marginTop: 48 }}
    />
  )
}
