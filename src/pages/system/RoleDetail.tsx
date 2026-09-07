import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spin, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { getRole } from '../../api/roles'
import type { RoleListItem } from '../../types/user'
import { useI18n } from '../../i18n/useI18n'
import TrimInput from '../../components/TrimInput'
import SectionTitle from '../../components/SectionTitle'
import ProcessedHistoryTab from '../../components/ProcessedHistoryTab'

export default function RoleDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [role, setRole] = useState<RoleListItem | null>(null)
  const [loading, setLoading] = useState(false)

  const loadRole = async (roleId: number) => {
    setLoading(true)
    try {
      const data = await getRole(roleId)
      setRole(data)
    } catch {
      message.error(t('common.msg.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRole(Number(id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, t])

  return (
    <div className="main-container">
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/system/roles')}>
          {t('common.back')}
        </Button>
      </div>

      <Spin spinning={loading}>
        {role && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ borderLeft: '3px solid #1890ff', paddingLeft: 8, marginBottom: 16 }}>{t('system.role.detailSection.basic')}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ color: '#666', marginBottom: 4 }}>{t('system.role.colCode')}</div>
                  <TrimInput value={role.code} disabled />
                </div>
                <div>
                  <div style={{ color: '#666', marginBottom: 4 }}>{t('system.role.colName')}</div>
                  <TrimInput value={role.name} disabled />
                </div>
                <div>
                  <div style={{ color: '#666', marginBottom: 4 }}>{t('common.status')}</div>
                  <TrimInput value={role.status === 'active' ? t('common.enabled') : t('common.disabled')} disabled />
                </div>
              </div>
              <div>
                <div style={{ color: '#666', marginBottom: 4 }}>{t('common.notes')}</div>
                <TrimInput.TextArea value={role.description || ''} disabled rows={2} />
              </div>
            </div>
            <div>
              <SectionTitle title={t('system.role.detailSection.history')} />
              <div style={{ paddingLeft: 20 }}>
                <ProcessedHistoryTab entityType="role" entityId={Number(id)} mode="full" />
              </div>
            </div>
          </div>
        )}
      </Spin>
    </div>
  )
}
