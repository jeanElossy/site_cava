import {
  createContext,
  useContext,
  useReducer,
} from "react";

const RegistrationContext = createContext();

// Exporté pour les tests (voir RegistrationForm/data.test.js) et pour
// RESET. Le composant du fichier reste RegistrationProvider ; ces
// exports supplémentaires désactivent Fast Refresh sur ce fichier
// précis, sans conséquence en dehors du confort de rechargement en
// développement.
// eslint-disable-next-line react-refresh/only-export-components
export const initialState = {
  // "new" : jamais inscrit. "update" : porteur d'un matricule déjà
  // attribué (papier ou informatisé), qui vient compléter ou corriger
  // sa fiche.
  kind: "new",

  submittedRegistrationNumber: "",

  data: {
    firstName: "",
    lastName: "",
    church: "",
    flock: "",
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    childrenCount: "",
    conversionYear: "",
    baptismWater: false,
    baptismWaterYear: "",
    baptismHolySpirit: false,
    previousChurch: "",
    profession: "",
    skills: "",
    desiredDepartment: "",
    availability: "",
  },
};

function registrationReducer(state, action) {
  switch (action.type) {
    case "SET_KIND":
      return { ...state, kind: action.payload };

    case "SET_SUBMITTED_REGISTRATION_NUMBER":
      return { ...state, submittedRegistrationNumber: action.payload };

    case "UPDATE_DATA":
      return { ...state, data: { ...state.data, ...action.payload } };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

export const RegistrationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(
    registrationReducer,
    initialState
  );

  return (
    <RegistrationContext.Provider value={{ state, dispatch }}>
      {children}
    </RegistrationContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useRegistration = () => useContext(RegistrationContext);
