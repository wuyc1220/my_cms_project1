import { Card, Row, Col, Typography, Statistic } from 'antd'
import { useI18n } from '../i18n/useI18n'

const { Title } = Typography

export default function Dashboard() {
  const { t } = useI18n()

  const stats = [
    { titleKey: 'dashboard.vodCount', value: 0, color: '#1677ff' },
    { titleKey: 'dashboard.liveChannelCount', value: 0, color: '#52c41a' },
    { titleKey: 'dashboard.validLicenses', value: 0, color: '#fa8c16' },
    { titleKey: 'dashboard.pendingTasks', value: 0, color: '#ff4d4f' },
  ] as const

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        {t('dashboard.title')}
      </Title>
      <Row gutter={[16, 16]}>
        {stats.map((s) => (
          <Col xs={24} sm={12} lg={6} key={s.titleKey}>
            <Card>
              <Statistic title={t(s.titleKey)} value={s.value} valueStyle={{ color: s.color }} />
            </Card>
          </Col>
        ))}
      </Row>
      <div style={{ marginTop: 24, color: '#666' }}>{t('dashboard.tip')}</div>
    </div>
  )
}
