'use client'


import SelectField from '@/components/SelectField'
import {
  PreschoolAdmissionData,
  ENROLLMENT_LEVELS,
  EnglishExposure,
  DeclarationSignatory,
  EnrollmentLevel,
} from '@/lib/preschoolAdmissionForm'
import DocumentUploadField from '@/components/students/DocumentUploadField'
import {
  StudentDocumentType,
  StudentDocumentsState,
  STUDENT_DOCUMENT_LABELS,
} from '@/lib/studentDocuments'

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="h-4 w-1 rounded-full bg-amber-400/90" aria-hidden />
          <h4 className="text-sm font-semibold uppercase tracking-wide text-white/90">{title}</h4>
        </div>
        {description && <p className="meta-text mt-1.5 ml-3.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}

const fieldErrorClass = (hasError: boolean) =>
  hasError ? 'border-red-400/70 focus:ring-red-400/30' : ''

type Props = {
  data: PreschoolAdmissionData
  onChange: (data: PreschoolAdmissionData) => void
  middleName: string
  onMiddleNameChange: (value: string) => void
  aadhaarNumber: string
  onAadhaarChange: (value: string) => void
  placeOfBirth: string
  onPlaceOfBirthChange: (value: string) => void
  academicYearName?: string
  admissionNumberPreview?: string
  errors?: Record<string, string>
  touched?: Record<string, boolean>
  onEnrollmentSelect?: (level: EnrollmentLevel) => void
  documents: StudentDocumentsState
  onDocumentFileSelect: (type: StudentDocumentType, file: File) => void
  onDocumentRemove: (type: StudentDocumentType) => void
}

export default function PreschoolAdmissionFormFields({
  data,
  onChange,
  middleName,
  onMiddleNameChange,
  aadhaarNumber,
  onAadhaarChange,
  placeOfBirth,
  onPlaceOfBirthChange,
  academicYearName,
  admissionNumberPreview,
  errors = {},
  touched = {},
  onEnrollmentSelect,
  documents,
  onDocumentFileSelect,
  onDocumentRemove,
}: Props) {
  const renderDocument = (type: StudentDocumentType, compact = false) => {
    const slot = documents[type]
    return (
      <DocumentUploadField
        label={STUDENT_DOCUMENT_LABELS[type]}
        previewUrl={slot.previewUrl}
        hasExisting={!!slot.existingUrl}
        markedForRemoval={slot.remove}
        onFileSelect={(file) => onDocumentFileSelect(type, file)}
        onRemove={() => onDocumentRemove(type)}
        compact={compact}
      />
    )
  }
  const patch = (partial: Partial<PreschoolAdmissionData>) => onChange({ ...data, ...partial })

  const patchAddress = (
    key: 'permanent_address' | 'communication_address',
    field: keyof PreschoolAdmissionData['permanent_address'],
    value: string
  ) => {
    onChange({
      ...data,
      [key]: { ...data[key], [field]: value },
    })
  }

  const patchParent = (
    key: 'father' | 'mother',
    field: keyof PreschoolAdmissionData['father'],
    value: string
  ) => {
    onChange({
      ...data,
      [key]: { ...data[key], [field]: value },
    })
  }

  const patchEmergency = (index: number, field: string, value: string) => {
    const contacts = [...data.emergency_contacts]
    contacts[index] = { ...contacts[index], [field]: value }
    patch({ emergency_contacts: contacts })
  }

  const patchSibling = (index: number, field: string, value: string) => {
    const siblings = [...data.siblings]
    siblings[index] = { ...siblings[index], [field]: value }
    patch({ siblings })
  }

  return (
    <div className="space-y-7">
      <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 px-5 py-4">
        <h3 className="text-base font-semibold text-amber-100 text-center tracking-wide">
          APPLICATION FORM
        </h3>
        <p className="meta-text text-center mt-2 text-xs">
          Please use block letters to fill all details. Fields marked with{' '}
          <span className="text-red-400">*</span> are required.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="label-text">Reg No.</label>
            <p className="input-field bg-black/20 text-white/80 font-mono">
              {admissionNumberPreview || 'Auto-generated on save'}
            </p>
          </div>
          <div>
            <label className="label-text">For Academic Session</label>
            <p className="input-field bg-black/20 text-white/80">{academicYearName || '—'}</p>
          </div>
          <div>
            <label htmlFor="date_of_admission" className="label-text">
              Date of Admission
            </label>
            <input
              type="date"
              id="date_of_admission"
              value={data.date_of_admission}
              onChange={(e) => patch({ date_of_admission: e.target.value })}
              className="input-field"
            />
          </div>
        </div>
      </div>

      <Section title="Particulars of the Child">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4">
          <div>
            <label htmlFor="middle_name" className="label-text">Middle Name</label>
            <input
              id="middle_name"
              value={middleName}
              onChange={(e) => onMiddleNameChange(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="aadhaar_number" className="label-text">Aadhaar No.</label>
            <input
              id="aadhaar_number"
              value={aadhaarNumber}
              onChange={(e) => onAadhaarChange(e.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="12-digit Aadhaar"
              maxLength={12}
              className="input-field font-mono tracking-wider"
            />
          </div>
          <div className="md:col-span-3">
            {renderDocument('student_aadhaar')}
          </div>
          <div>
            <label htmlFor="place_of_birth" className="label-text">Place of Birth</label>
            <input
              id="place_of_birth"
              value={placeOfBirth}
              onChange={(e) => onPlaceOfBirthChange(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </Section>

      <div className="border-t border-white/10" />

      <Section title="Enrollment Details" description="Select the programme level for admission.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ENROLLMENT_LEVELS.map((level) => (
            <label
              key={level.value}
              className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                data.enrollment_level === level.value
                  ? 'border-amber-400/50 bg-amber-400/10'
                  : 'border-white/10 bg-black/15 hover:border-white/20'
              }`}
            >
              <input
                type="radio"
                name="enrollment_level"
                checked={data.enrollment_level === level.value}
                onChange={() => {
                  patch({ enrollment_level: level.value })
                  onEnrollmentSelect?.(level.value)
                }}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-white">{level.label}</span>
                <span className="block text-xs text-white/55 mt-0.5">({level.ageRange})</span>
              </span>
            </label>
          ))}
        </div>
        {touched.class_id && errors.class_id && (
          <p className="text-sm text-red-300">{errors.class_id}</p>
        )}
      </Section>

      <div className="border-t border-white/10" />

      <Section title="Residence">
        <div className="space-y-6">
          <div className="space-y-4 rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-sm font-medium text-white/85">a) Permanent Address</p>
            <textarea
              rows={2}
              value={data.permanent_address.address}
              onChange={(e) => patchAddress('permanent_address', 'address', e.target.value)}
              className="input-field"
              placeholder="Full permanent address"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                placeholder="Pin"
                value={data.permanent_address.pin}
                onChange={(e) => patchAddress('permanent_address', 'pin', e.target.value)}
                className="input-field"
              />
              <input
                placeholder="Telephone"
                value={data.permanent_address.telephone}
                onChange={(e) => patchAddress('permanent_address', 'telephone', e.target.value)}
                className="input-field"
              />
              <input
                placeholder="Mobile"
                value={data.permanent_address.mobile}
                onChange={(e) => patchAddress('permanent_address', 'mobile', e.target.value)}
                className="input-field"
              />
              <input
                type="email"
                placeholder="Email"
                value={data.permanent_address.email}
                onChange={(e) => patchAddress('permanent_address', 'email', e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-sm font-medium text-white/85">b) Address for Communication</p>
            <textarea
              rows={2}
              value={data.communication_address.address}
              onChange={(e) => patchAddress('communication_address', 'address', e.target.value)}
              className="input-field"
              placeholder="Communication address (if different)"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                placeholder="Pin"
                value={data.communication_address.pin}
                onChange={(e) => patchAddress('communication_address', 'pin', e.target.value)}
                className="input-field"
              />
              <input
                placeholder="Telephone"
                value={data.communication_address.telephone}
                onChange={(e) => patchAddress('communication_address', 'telephone', e.target.value)}
                className="input-field"
              />
              <input
                placeholder="Mobile"
                value={data.communication_address.mobile}
                onChange={(e) => patchAddress('communication_address', 'mobile', e.target.value)}
                className="input-field"
              />
              <input
                type="email"
                placeholder="Email"
                value={data.communication_address.email}
                onChange={(e) => patchAddress('communication_address', 'email', e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        </div>
      </Section>

      <div className="border-t border-white/10" />

      <Section title="Health & Language">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
          <div className="md:col-span-2">
            <label className="label-text">Health complications, if any</label>
            <textarea
              rows={2}
              value={data.health_complications}
              onChange={(e) => patch({ health_complications: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">Allergies, if any</label>
            <textarea
              rows={2}
              value={data.allergies}
              onChange={(e) => patch({ allergies: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">Currently under any medication</label>
            <textarea
              rows={2}
              value={data.medication}
              onChange={(e) => patch({ medication: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="md:col-span-2">
            {renderDocument('vaccination_certificate')}
          </div>
          <div>
            <label className="label-text">Mother Tongue</label>
            <input
              value={data.mother_tongue}
              onChange={(e) => patch({ mother_tongue: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">Other Communication Skills</label>
            <textarea
              rows={2}
              value={data.communication_skills}
              onChange={(e) => patch({ communication_skills: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label-text">Exposure to the English Language</label>
            <div className="flex flex-col sm:flex-row gap-4 mt-2">
              {(
                [
                  ['both_parents_conversant', 'Both the Parents are conversant'],
                  ['familiar_with_language', 'Familiar with the language'],
                ] as [EnglishExposure, string][]
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-white/85">
                  <input
                    type="radio"
                    name="english_exposure"
                    checked={data.english_exposure === value}
                    onChange={() => patch({ english_exposure: value })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <div className="border-t border-white/10" />

      <Section title="Family Particulars">
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-black/20">
                <th className="text-left p-3 text-white/70 font-medium w-36">Particulars</th>
                <th className="text-left p-3 text-white/70 font-medium">Father</th>
                <th className="text-left p-3 text-white/70 font-medium">Mother</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(
                [
                  ['name', 'Name'],
                  ['qualification', 'Qualification'],
                  ['occupation', 'Occupation / Designation'],
                  ['organization', 'Organization / Company'],
                  ['office_address', 'Office Address'],
                  ['office_telephone', 'Office Telephone'],
                  ['mobile', 'Mobile'],
                  ['email', 'Email ID'],
                ] as const
              ).map(([field, label]) => (
                <tr key={field}>
                  <td className="p-3 text-white/60 align-top">{label}</td>
                  <td className="p-3">
                    <input
                      type={field === 'email' ? 'email' : 'text'}
                      value={data.father[field]}
                      onChange={(e) => patchParent('father', field, e.target.value)}
                      className="input-field text-sm py-1.5"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type={field === 'email' ? 'email' : 'text'}
                      value={data.mother[field]}
                      onChange={(e) => patchParent('mother', field, e.target.value)}
                      className="input-field text-sm py-1.5"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {renderDocument('father_aadhaar')}
          {renderDocument('mother_aadhaar')}
        </div>
      </Section>

      <div className="border-t border-white/10" />

      <Section title="Emergency Contacts" description="Persons who can be contacted in case of emergency.">
        <div className="space-y-4">
          {data.emergency_contacts.map((contact, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-xl border border-white/10 bg-black/10 p-4">
              <input
                placeholder="Name"
                value={contact.name}
                onChange={(e) => patchEmergency(index, 'name', e.target.value)}
                className="input-field"
              />
              <input
                placeholder="Relation"
                value={contact.relation}
                onChange={(e) => patchEmergency(index, 'relation', e.target.value)}
                className="input-field"
              />
              <input
                placeholder="Occupation"
                value={contact.occupation}
                onChange={(e) => patchEmergency(index, 'occupation', e.target.value)}
                className="input-field"
              />
              <input
                placeholder="Address"
                value={contact.address}
                onChange={(e) => patchEmergency(index, 'address', e.target.value)}
                className="input-field"
              />
              <input
                placeholder="Mobile"
                value={contact.mobile}
                onChange={(e) => patchEmergency(index, 'mobile', e.target.value)}
                className="input-field"
              />
            </div>
          ))}
        </div>
      </Section>

      <div className="border-t border-white/10" />

      <Section title="Sibling Information">
        <div className="space-y-4">
          {data.siblings.map((sibling, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-xl border border-white/10 bg-black/10 p-4">
              <input
                placeholder="Name & Age"
                value={sibling.name_age}
                onChange={(e) => patchSibling(index, 'name_age', e.target.value)}
                className="input-field"
              />
              <input
                placeholder="Gender"
                value={sibling.gender}
                onChange={(e) => patchSibling(index, 'gender', e.target.value)}
                className="input-field"
              />
              <input
                placeholder="School"
                value={sibling.school}
                onChange={(e) => patchSibling(index, 'school', e.target.value)}
                className="input-field"
              />
              <input
                placeholder="Class"
                value={sibling.class_name}
                onChange={(e) => patchSibling(index, 'class_name', e.target.value)}
                className="input-field"
              />
              <input
                placeholder="Year of Joining"
                value={sibling.year_of_joining}
                onChange={(e) => patchSibling(index, 'year_of_joining', e.target.value)}
                className="input-field"
              />
            </div>
          ))}
          <div>
            <label className="label-text">Other Sibling(s) Information (if any)</label>
            <textarea
              rows={2}
              value={data.other_siblings_info}
              onChange={(e) => patch({ other_siblings_info: e.target.value })}
              className="input-field"
            />
          </div>
        </div>
      </Section>

      <div className="border-t border-white/10" />

      <Section title="Declaration">
        <div className="rounded-xl border border-white/10 bg-black/15 p-4 space-y-4 text-xs text-white/70 leading-relaxed">
          <div>
            I,{' '}
            <SelectField
              value={data.declaration_signatory}
              onChange={(e) => patch({ declaration_signatory: e.target.value as DeclarationSignatory })}
              className="select-field inline-block w-auto text-xs py-1 mx-1"
            >
              <option value="father">Father</option>
              <option value="mother">Mother</option>
              <option value="guardian">Guardian</option>
            </SelectField>
            declare and agree to abide by the school terms and conditions including fee payment,
            non-refundable policy, jurisdiction, and accuracy of information furnished herein.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label-text">Date</label>
              <input
                type="date"
                value={data.declaration_date}
                onChange={(e) => patch({ declaration_date: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Place</label>
              <input
                value={data.declaration_place}
                onChange={(e) => patch({ declaration_place: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Signature</label>
              <input
                value={data.declaration_signature}
                onChange={(e) => patch({ declaration_signature: e.target.value })}
                className="input-field"
                placeholder="Parent / Guardian signature"
              />
            </div>
          </div>
        </div>
      </Section>

      <div className="border-t border-white/10" />

      <Section title="For Office Use Only">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-dashed border-white/20 bg-black/10 p-4">
          <div>
            <label className="label-text">Registration date</label>
            <input
              type="date"
              value={data.office_registration_date}
              onChange={(e) => patch({ office_registration_date: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">Due date for admission</label>
            <input
              type="date"
              value={data.office_due_date}
              onChange={(e) => patch({ office_due_date: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label-text">Remarks of Centre Head / Counsellor</label>
            <textarea
              rows={3}
              value={data.office_remarks}
              onChange={(e) => patch({ office_remarks: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">Admission granted / Not granted</label>
            <input
              value={data.office_admission_granted}
              onChange={(e) => patch({ office_admission_granted: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">Signature of Centre Head / Counsellor</label>
            <input
              value={data.office_counsellor_signature}
              onChange={(e) => patch({ office_counsellor_signature: e.target.value })}
              className="input-field"
            />
          </div>
        </div>
      </Section>

      <div className="border-t border-white/10" />

      <Section title="Refer a Buddy" description="Refer your buddies to get a priority window to school experiences.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            placeholder="Child's Name"
            value={data.refer_buddy.child_name}
            onChange={(e) =>
              patch({ refer_buddy: { ...data.refer_buddy, child_name: e.target.value } })
            }
            className="input-field"
          />
          <input
            placeholder="Age"
            value={data.refer_buddy.age}
            onChange={(e) => patch({ refer_buddy: { ...data.refer_buddy, age: e.target.value } })}
            className="input-field"
          />
          <input
            placeholder="Parent's Name"
            value={data.refer_buddy.parent_name}
            onChange={(e) =>
              patch({ refer_buddy: { ...data.refer_buddy, parent_name: e.target.value } })
            }
            className="input-field"
          />
          <input
            placeholder="Father / Mother's Name"
            value={data.refer_buddy.father_mother_name}
            onChange={(e) =>
              patch({ refer_buddy: { ...data.refer_buddy, father_mother_name: e.target.value } })
            }
            className="input-field"
          />
          <input
            placeholder="Contact No."
            value={data.refer_buddy.contact_no}
            onChange={(e) =>
              patch({ refer_buddy: { ...data.refer_buddy, contact_no: e.target.value } })
            }
            className="input-field"
          />
          <div className="flex items-center gap-4">
            {(
              [
                ['relatives', 'Relatives'],
                ['acquaintances', 'Acquaintances'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm text-white/85">
                <input
                  type="radio"
                  name="refer_relation"
                  checked={data.refer_buddy.relation_type === value}
                  onChange={() =>
                    patch({ refer_buddy: { ...data.refer_buddy, relation_type: value } })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </Section>

      <div className="border-t border-white/10" />

      <Section title="Photo Permission Form">
        <div className="rounded-xl border border-white/10 bg-black/15 p-4 space-y-4">
          <p className="text-xs text-white/65 leading-relaxed">
            I give consent for use of photographs of my child in magazines, flyers, prospectus,
            advertisements, and other publications of the organization for promotional and research
            purposes even after withdrawal from the school.
          </p>
          <label className="flex items-start gap-3 text-sm text-white/85">
            <input
              type="checkbox"
              checked={data.photo_permission_consent}
              onChange={(e) => patch({ photo_permission_consent: e.target.checked })}
              className="mt-1"
            />
            I agree to the photo permission terms stated above.
          </label>
          <div>
            <label className="label-text">Signature of Parent / Guardian with date</label>
            <input
              value={data.photo_permission_signature_date}
              onChange={(e) => patch({ photo_permission_signature_date: e.target.value })}
              className={`input-field ${fieldErrorClass(false)}`}
              placeholder="Name & date"
            />
          </div>
        </div>
      </Section>
    </div>
  )
}
